/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/*
 * main.js is the entry point for the application.
 */
require("../css/font-awesome.css");
require("../css/normalize.css");
require("../css/foundation.min.css");
require("../css/style.css");
require("../css/toastr.min.css");

// context is the application context
// dashboard is the bridge between the application context and the apps
var context = require("./context.js");
var dashboard = require("./dashboard.js");

// Vendor libraries

var $ = require("jquery");
var Backbone = require("backbone");
var underscore = require("underscore");

// Our libraries
var FabMoAPI = require("./libs/fabmoapi.js");
var FabMoUI = require("./libs/fabmoui.js");
var Keyboard = require("./libs/keyboard.js");
var Keypad = require("./libs/keypad.js");

var keypad, keyboard;

// API object defines our connection to the tool.
var engine = new FabMoAPI(); // Not sure that "engine" was the name we wanted to use here

var modalIsShown = false;
var daisyIsShown = false;
var authorizeDialog = false;
var interlockDialog = false;
var isRunning = false;
var keyPressed = false;
var isAuth = false;
var lastInfoSeen = null;
var consent = "";
var disconnected = false;
var calledFromModal = ""; // variable for passing action from Keypad modal to engine
var last_state_seen = null;
var in_goto_flag = false;
var fixedTimeStart = 0; // variable for measuring response latency in keypad fixed moves
var fixedTimeEnd = 0;

// move timer cutoff to var so it can be set in settings later
var TIMER_DISPLAY_CUTOFF = 5;
// Detect touch screen
var supportsTouch = "ontouchstart" in window || navigator.msMaxTouchPoints;

// Initial read of engine configuration

// check user
engine.getCurrentUser(function (err, user) {
    if (user === undefined) {
        window.location.href = "#/authentication";
    }
});

var setUpManual = function () {
    calledFromModal = "";
    // Turn off fixed-distance if it is on (someone may want remembering to be an option?)
    $(".drive-button").removeClass("drive-button-fixed");
    $(".slidecontainer").show();
    $(".fixed-input-container").hide();
    $(".fixed-switch input").prop("checked", false);
    engine.getConfig(function (err, config) {
        if (err) {
            console.log(err);
        } else {
            var manual_config = config.machine.manual;
            if (manual_config.xy_increment) {
                $(".xy-fixed").val(manual_config.xy_increment);
                $(".z-fixed").val(manual_config.z_increment);
                $(".abc-fixed").val(manual_config.abc_increment);
            } else {
                $(".xy-fixed").val(0.1);
                $(".z-fixed").val(0.01);
            }
            $("#manual-move-speed").val(manual_config.xy_speed);
            $("#manual-move-speed").attr("min", manual_config.xy_min);
            $("#manual-move-speed").attr("max", manual_config.xy_max);
            ///hack to get extra axes to show up
            var enabledAxes = {};
            var checkEnabled = ["xam", "yam", "zam", "aam", "bam", "cam"];
            checkEnabled.forEach(function (axi) {
                enabledAxes[axi] = config.driver[axi];
            });
            engine.setConfig({ driver: enabledAxes }, function (err, data) {});
        }
    });
    // Customize for video
    let current_App = localStorage.getItem("currentapp");
    let app_has_video = localStorage.getItem("fabmo_sb4_has_video");
    if (current_App === "video" || (current_App === "fabmo-sb4" && app_has_video === "true")) {
        // just kludged for moment
        $("#keypad-modal").css("opacity", "0.55");
        $(".manual-drive-modal").css("background-color", "rgba(0,0,0,0)");
        $(".modalDim").css("background-color", "rgba(0,0,0,0)");
    } else {
        $("#keypad-modal").css("opacity", "1.00");
        $(".manual-drive-modal").css("background-color", "#ffda29");
        $(".modalDim").css("background-color", "rgba(0,0,0,0.45)");
    }
};

engine.getVersion(function (err, version) {
    context.setEngineVersion(version);

    context.apps = new context.models.Apps();
    // Load the apps from the server
    context.apps.fetch({
        success: function () {
            // Create a FabMo object for the dashboard
            dashboard.setEngine(engine);
            console.log("Configuring this FabMo ...");
            setUpManual(); // Configures all axis displays
            dashboard.ui = new FabMoUI(dashboard.engine);
            dashboard.getNetworkIdentity();

            keyboard = setupKeyboard();
            keypad = setupKeypad();

            // Start the application
            router = new context.Router();
            router.setContext(context);

            dashboard.setRouter(router);

            // Sort of a hack, but works OK.
            $(".loader").hide();

            // Start backbone routing
            Backbone.history.start();

            // Request a status update from the tool
            engine.getStatus();

            dashboard.engine.on("change", function (topic) {
                if (topic === "apps") {
                    context.apps.fetch();
                }
            });

            // ------------------------------------------------------------ STATUS HANDLER
            dashboard.engine.on("status", function (status) {
                fixedTimeEnd = Date.now();
                console.log(status);
                if (status.state == "dead") {
                    dashboard.showModal({
                        title: "An Error Occurred!",
                        message: status.info.error,
                        noButton: true,
                    });
                    return;
                }
                if (status.currentCmd === "fixed") {
                    // report on keypad response latency
                    console.log(fixedTimeEnd - fixedTimeStart);
                }
                if (status.state === "manual") {
                    if (!status["hideKeypad"]) {
                        $(".modalDim").show();
                        $(".manual-drive-modal").show();
                        // if currently running a goto command in manual keypad and have stopped and resumed
                        if (status.stat === 5 && (status.currentCmd === "goto" || status.currentCmd === "resume")) {
                            $(".manual-stop").show();
                            $(".go-to, .set-coordinates").hide();
                            keyboard.setEnabled(false);
                            $("#keypad").hide();
                            $(".go-to-container").show();
                        } else {
                            // if an axis is selected in go-to or set, then flag is true
                            if (in_goto_flag) {
                                in_goto_flag = false;
                                $(".manual-stop").hide();
                                $(".go-to, .set-coordinates").show();
                                keyboard.setEnabled(false);
                                $("#keypad").hide();
                                $(".go-to-container").show();
                                // Otherwise switch to default manual keypad
                            } else {
                                $(".manual-stop").hide();
                                $(".go-to, .set-coordinates").show();
                                keyboard.setEnabled(true);
                                $("#keypad").show();
                                $(".go-to-container").hide();
                            }
                        }
                    }
                }

                if (status.state !== "manual" && last_state_seen === "manual") {
                    $(".modalDim").hide();
                    $(".manual-drive-modal").hide();
                    keyboard.setEnabled(false);
                }

                if (
                    (status.state != "armed" && last_state_seen === "armed") ||
                    (status.state != "paused" && last_state_seen === "paused") ||
                    (status.state != "interlock" && last_state_seen === "interlock") ||
                    (status.state != "lock" && last_state_seen === "lock")
                ) {
                    dashboard.hideModal();
                    modalIsShown = false;
                }

                if (last_state_seen != status.state) {
                    last_state_seen = status.state;
                }

                switch (status.state) {
                    case "running":
                    case "probing":
                    case "paused":
                    case "stopped":
                        if (modalIsShown === false) {
                            dashboard.handlers.showFooter();
                        }
                        break;
                    default:
                        dashboard.handlers.hideFooter();
                        break;
                }

                if (status.state != "idle") {
                    $("#position input").attr("disabled", true);
                    // authenticate.setIsRunning(true);
                } else {
                    // NOW IN IDLE
                    // Send a requested ACTION from KEYPAD modal when we get back to "idle"
                    // Might be able to add a return to Keypad if that becomes a desired feature
                    engine.getStatus();
                    if (status.currentCmd === "exit" && calledFromModal && status.stat === 4) {
                        // Institute a 0.5 second delay to allow G2 to get back to idle
                        setTimeout(function () {
                            // Sort out the tpe of action requested
                            console.log("Action called From Modal: " + calledFromModal);
                            var match = calledFromModal.match(/(\d{1,2})$|([a-zA-Z]{2})$/);
                            if (match) {
                                if (match[1]) {
                                    calledFromModal = match[1];
                                    dashboard.engine.runMacro(calledFromModal);
                                } else {
                                    calledFromModal = match[2].toUpperCase();
                                    engine.sbp(calledFromModal);
                                    // Had trouble gettgin this to run reliably and added timeout
                                    //   Tried with dashboard.engine., and engine. calls
                                    //   Perhaps runCode might have been better?
                                }
                            }
                            calledFromModal = "";
                        }, 500);
                    } else {
                        $("#position input").attr("disabled", false);
                        // authenticate.setIsRunning(false);
                    }
                }
                if (status["info"] && status["info"]["id"] != lastInfoSeen) {
                    lastInfoSeen = status["info"]["id"];
                    if (status.info["message"]) {
                        if (status.state === "manual") {
                            $("#title_goto").css("visibility", "hidden");
                            $(".manual-drive-message").show();
                            $(".manual-drive-message").html(status.info.message);
                        } else if (status.info["timer"] && status.info["timer"] <= TIMER_DISPLAY_CUTOFF) {
                            keypad.setEnabled(false);
                            keyboard.setEnabled(false);
                        } else {
                            keypad.setEnabled(false);
                            keyboard.setEnabled(false);
                            console.log(status["info"]);
                            // Default modal options for backwards compatibility
                            modalOptions = {
                                message: status.info.message,
                            };
                            var resumeFunction = function () {
                                dashboard.engine.resume();
                            };
                            var cancelFunction = function () {
                                dashboard.engine.quit();
                            };
                            //set up input submit
                            if (status["info"]["input"]) {
                                modalOptions["input"] = status["info"]["input"];
                                resumeFunction = function () {
                                    var inputVar = $("#inputVar").val();
                                    var inputType = $("#inputType").val();
                                    var inputVal = $.trim($("#inputVal").val());
                                    dashboard.engine.resume({
                                        var: inputVar,
                                        type: inputType,
                                        val: inputVal,
                                    });
                                    //  TODO: stop modal from closing on click so we can validate.
                                    // if(inputVal != '') {
                                    //     $('.inputError').hide();
                                    //     dashboard.engine.resume({'var': inputVar, 'val': inputVal});
                                    // } else {
                                    //     $('.inputError').show();
                                    // }
                                };
                            }
                            (modalOptions.okText = "Resume"),
                                (modalOptions.cancelText = "Quit"),
                                (modalOptions.ok = resumeFunction),
                                (modalOptions.cancel = cancelFunction);
                            if (status.info["custom"]) {
                                // Custom button action and text
                                if (status.info.custom["ok"]) {
                                    modalOptions.okText = status.info.custom.ok["text"];
                                    switch (status.info.custom.ok["func"]) {
                                        case "resume":
                                            modalOptions.ok = resumeFunction;
                                            break;
                                        case "quit":
                                            modalOptions.ok = cancelFunction;
                                            break;
                                        default:
                                            modalOptions.ok = false;
                                    }
                                }
                                if (status.info.custom["cancel"]) {
                                    modalOptions.cancelText = status.info.custom.cancel["text"];
                                    switch (status.info.custom.cancel["func"]) {
                                        case "resume":
                                            modalOptions.cancel = resumeFunction;
                                            break;
                                        case "quit":
                                            modalOptions.cancel = cancelFunction;
                                            break;
                                        default:
                                            modalOptions.cancel = function () {
                                                modalIsShown = false;
                                            };
                                    }
                                }
                                if (status.info.custom["detail"]) {
                                    modalOptions["detail"] = status.info.custom["detail"];
                                }
                                if (status.info.custom["title"]) {
                                    modalOptions["title"] = status.info.custom["title"];
                                }
                                if (status.info.custom["noButton"]) {
                                    modalOptions.noButton = true;
                                }
                            }
                            dashboard.showModal(modalOptions);
                            modalIsShown = true;
                            dashboard.handlers.hideFooter();
                        }
                    } else if (status.info["error"]) {
                        if (dashboard.engine.status.job) {
                            var detailHTML =
                                "<p>" +
                                "<b>Job Name:  </b>" +
                                dashboard.engine.status.job.name +
                                "<br />" +
                                "<b>Job Description:  </b>" +
                                dashboard.engine.status.job.description +
                                "</p>";
                        } else {
                            detailHTML =
                                '<p>Check the log <a href="/log" target="_blank"><span style="color: blue"> for more information</span>.</a></p>';
                        }
                        dashboard.showModal({
                            title: "An Error Occurred!",
                            message: status.info.error,
                            detail: detailHTML,
                            cancelText: "Close",
                            cancel: function () {
                                modalIsShown = false;
                            },
                        });
                        modalIsShown = true;
                        dashboard.handlers.hideFooter();
                    }
                    // quitFlag prevents authorize dialog from popping up
                    // after quitting from authorize dialog
                } else if (status.state === "armed" && status.quitFlag === false) {
                    authorizeDialog = true;
                    keypad.setEnabled(false);
                    keyboard.setEnabled(false);
                    dashboard.showModal({
                        title: "Authorization Required!",
                        message: "To authorize your tool, press and hold the start button for one second.",
                        cancelText: "Quit",
                        cancel: function () {
                            authorizeDialog = false;
                            dashboard.engine.quit(function (err, result) {
                                if (err) {
                                    console.log("ERRROR: " + err);
                                }
                            });
                        },
                    });
                } else if (status.state === "limit" && status.resumeFlag === false) {
                    interlockDialog = true;
                    keypad.setEnabled(false);
                    keyboard.setEnabled(false);
                    dashboard.showModal({
                        title: "Limit Hit!",
                        message:
                            "Limit Switch has been Hit! Quit will temporarily over-ride Limit sensor to allow backing off with Keypad.",
                        cancelText: "Quit",
                        cancel: function () {
                            interlockDialog = false;
                            dashboard.engine.quit(function (err, result) {
                                if (err) {
                                    console.log("ERRROR: " + err);
                                }
                            });
                        },
                    });
                } else if (status.state === "interlock" && status.resumeFlag === false) {
                    interlockDialog = true;
                    keypad.setEnabled(false);
                    keyboard.setEnabled(false);
                    dashboard.showModal({
                        title: "Safety Interlock Activated!",
                        message:
                            "You cannot perform the specified action with the safety interlock open.  Please close the safety interlock before Resuming.",
                        cancelText: "Quit",
                        cancel: function () {
                            interlockDialog = false;
                            dashboard.engine.quit(function (err, result) {
                                if (err) {
                                    console.log("ERRROR: " + err);
                                }
                            });
                        },
                        okText: "Resume",
                        ok: function () {
                            dashboard.engine.resume();
                        },
                    });
                } else if (status.state === "lock" && status.resumeFlag === false) {
                    interlockDialog = true;
                    keypad.setEnabled(false);
                    keyboard.setEnabled(false);
                    dashboard.showModal({
                        title: "Stop Input Activated!",
                        message: "Please release any Stop Input before continuing.",
                        cancelText: "Quit",
                        cancel: function () {
                            interlockDialog = false;
                            dashboard.engine.quit(function (err, result) {
                                if (err) {
                                    console.log("ERRROR: " + err);
                                }
                            });
                        },
                        okText: "Resume",
                        ok: function () {
                            dashboard.engine.resume();
                        },
                    });
                }
            });
        },
    });
});

function getManualMoveSpeed(move) {
    var speed_ips = null;
    if ($("#manual-move-speed").val()) {
        speed_ips = $("#manual-move-speed").val();
    }
    return speed_ips;
}

function getManualMoveJerk(move) {
    var jerk = null;
    try {
        switch (move.axis) {
            case "x":
            case "y":
                jerk = engine.config.machine.manual.xy_jerk;
                break;
            case "z":
                jerk = engine.config.machine.manual.z_jerk;
                break;
        }
    } catch (e) {
        console.error(e);
    }
    return jerk;
}

function getManualNudgeIncrement(move) {
    var increment_inches = null;
    try {
        switch (move.axis) {
            case "x":
            case "y":
                increment_inches = engine.config.machine.manual.xy_increment;
                break;
            case "z":
                increment_inches = engine.config.machine.manual.z_increment;
                break;
            case "a":
            case "b":
            case "c":
                increment_inches = engine.config.machine.manual.abc_increment;
                break;
        }
    } catch (e) {
        console.error(e);
    }
    return increment_inches;
}

function setupKeyboard() {
    var keyboard = new Keyboard();
    keyboard.on("go", function (move) {
        if (move.axis === "z") {
            dashboard.engine.manualStart(move.axis, move.dir * 60.0 * (getManualMoveSpeed(move) / 2 || 0.1));
        } else if (move) {
            dashboard.engine.manualStart(move.axis, move.dir * 60.0 * (getManualMoveSpeed(move) || 0.1));
        }
    });

    keyboard.on("stop", function (evt) {
        dashboard.engine.manualStop();
    });

    keyboard.on("nudge", function (nudge) {
        dashboard.engine.manualMoveFixed(
            nudge.axis,
            60 * getManualMoveSpeed(nudge),
            nudge.dir * getManualNudgeIncrement(nudge)
        );
    });

    return keyboard;
}

function setupKeypad() {
    var keypad = new Keypad("#keypad");
    keypad.on("go", function (move) {
        if (move.second_axis) {
            dashboard.engine.manualStart(
                move.axis,
                move.dir * 60.0 * (getManualMoveSpeed(move) || 0.1),
                move.second_axis,
                move.second_dir * 60.0 * (getManualMoveSpeed(move) || 0.1)
            );
        } else if (move.axis === "z_fast") {
            dashboard.engine.manualStart("z", move.dir * 60.0 * engine.config.machine.manual.z_fast_speed);
        } else if (move.axis === "z_slow") {
            dashboard.engine.manualStart("z", move.dir * 60.0 * engine.config.machine.manual.z_slow_speed);
        } else if (move) {
            dashboard.engine.manualStart(move.axis, move.dir * 60.0 * (getManualMoveSpeed(move) || 0.1));
        }
    });

    keypad.on("stop", function (evt) {
        keyPressed = false;
        dashboard.engine.manualStop();
    });

    keypad.on("nudge", function (nudge) {
        var speed = getManualMoveSpeed(nudge);
        var increment = getManualNudgeIncrement(nudge);
        // var jerk = getManualMoveJerk(nudge);
        fixedTimeStart = Date.now(); // for measuring keypad response latency
        if (nudge.second_axis) {
            dashboard.engine.manualMoveFixed(
                nudge.axis,
                60 * speed,
                nudge.dir * increment,
                nudge.second_axis,
                nudge.second_dir * increment
            );
        } else {
            dashboard.engine.manualMoveFixed(
                nudge.axis,
                60 * getManualMoveSpeed(nudge),
                nudge.dir * getManualNudgeIncrement(nudge)
            );
        }
    });

    return keypad;
}

$(".action-button").on("click", function () {
    // get the action from the button
    var action = $(this).attr("id");
    switch (action) {
        case "action-1":
            calledFromModal = "macro2";
            break;
        case "action-2":
            calledFromModal = "macro3";
            break;
        case "action-3":
            calledFromModal = "JH";
            break;
        case "action-4":
            calledFromModal = "macro79";
            break;
    }
    dashboard.engine.manualExit();
});

$(".manual-drive-exit").on("click", function () {
    $("#title_goto").css("visibility", "visible");
    $(".manual-drive-message").html("");
    $(".manual-drive-message").hide();
    calledFromModal = "";
    dashboard.engine.manualExit();
});

$(".manual-drive-enter").on("click", function () {
    setUpManual();
    dashboard.engine.manualEnter();
});

function showDaisy(callback) {
    if (daisyIsShown) {
        return;
    } else {
        dashboard.hideModal();
        daisyIsShown = true;
        dashboard.showModal({
            title: "Waiting for FabMo...",
            message: '<i class="fa fa-cog fa-spin" aria-hidden="true" style="font-size:40px;color:#313366" ></i>',
            noButton: true,
            noLogo: true,
        });
    }
}

function hideDaisy(callback) {
    callback = callback || function () {};
    if (!daisyIsShown) {
        return callback();
    }
    daisyIsShown = false;
    dashboard.hideModal();
}

// Click outside the modal keypad to close it  //th: don't know if I like this now that it is done?
const modalKeyPad = document.getElementById("keypad-modal");
function handleClickOutside(event) {
    if (modalKeyPad && !modalKeyPad.contains(event.target) && modalKeyPad.style.display === "block") {
        if (last_state_seen === "manual") {
            calledFromModal = "";
            dashboard.engine.manualExit();
        }
    }
}
// Attach the event listener to the document
document.addEventListener("click", handleClickOutside);

// Access slider for using speed up/dn keys (could not make our jquery work for this, need ui version?)
const slider = document.getElementById("manual-move-speed");
function triggerSliderEvent(value) {
    if (slider) {
        slider.value = value;
        const changeEvent = new Event("change");
        slider.dispatchEvent(changeEvent);
        const inputEvent = new Event("input");
        slider.dispatchEvent(inputEvent);
    }
}

// Key action from keyboard in Modal Keypad
$(document).on("keydown", function (e) {
    // escape key press to quit the engine
    if (e.key === "Escape") {
        // do this only if in manual mode
        if (last_state_seen === "manual") {
            console.warn("ESC key pressed - quitting manual mode.");
            calledFromModal = "";
            dashboard.engine.manualExit();
        }
    } else if (e.key === "k" && e.altKey) {
        // changed to alt but still not very useful, only working outside iframe
        calledFromModal = "";
        dashboard.engine.manualEnter();
        // toggle "Fixed" moves
    } else if (e.key === "f") {
        $(".fixed-switch").trigger("click");
        // increase or decrease speed
    } else if (e.key === ">" || e.key === "<") {
        let newSpeed;
        let adder = 0.1;
        if (dashboard.engine.status.unit === "mm") {
            adder = 1.0;
        }
        switch (e.key) {
            case ">":
                newSpeed = parseFloat($("#manual-move-speed").val()) + adder;
                triggerSliderEvent(newSpeed);
                break;
            case "<":
                newSpeed = parseFloat($("#manual-move-speed").val()) - adder;
                triggerSliderEvent(newSpeed);
                break;
        }
    }
});

// Goto this location
var axisValues = [];
var getAxis = function () {
    $(".axi").each(function () {
        var strings = this.getAttribute("class").split(" ")[0];
        var axis = strings.slice(-1).toUpperCase();
        axisValues.push({
            className: "." + strings,
            axis: axis,
        });
    });
};

$(".go-to").on("mousedown", function () {
    var move = {};
    $(".modal-axi:visible").each(function () {
        move[$(this).attr("id")] = parseFloat($(this).val());
    });
    dashboard.engine.goto(move);
});

$(".manual-stop").on("mousedown", function () {
    dashboard.engine.manualStop();
});

$(".set-coordinates").on("mousedown", function () {
    var move = {};
    $(".modal-axi:visible").each(function () {
        move[$(this).attr("id")] = parseFloat($(this).val());
    });
    dashboard.engine.set(move);
});

$(".fixed-switch input").on("change", function () {
    if ($(".fixed-switch input").is(":checked")) {
        $(".drive-button").addClass("drive-button-fixed");
        $(".slidecontainer").hide();
        $(".fixed-input-container").show();
        $(".fixed-input-container").css("display", "flex");
    } else {
        $(".drive-button").removeClass("drive-button-fixed");
        $(".slidecontainer").show();
        $(".fixed-input-container").hide();
    }
});

$("#manual-move-speed").on("change", function () {
    newDefault = $("#manual-move-speed").val();
    dashboard.engine.setConfig({ machine: { manual: { xy_speed: newDefault } } }, function (err, data) {
        if (err) {
            console.log(err);
        }
    });
});

$(".xy-fixed").on("change", function () {
    keyboard.setEnabled(false);
    newDefault = $(".xy-fixed").val();
    dashboard.engine.setConfig({ machine: { manual: { xy_increment: newDefault } } }, function (err, data) {
        if (err) {
            console.log(err);
        } else {
            engine.config.machine.manual.xy_increment = newDefault;
        }
    });
});

$(".z-fixed").on("change", function () {
    keyboard.setEnabled(false);
    newDefault = $(".z-fixed").val();
    dashboard.engine.setConfig({ machine: { manual: { z_increment: newDefault } } }, function (err, data) {
        if (err) {
            console.log(err);
        } else {
            engine.config.machine.manual.z_increment = newDefault;
        }
    });
});

$(".abc-fixed").on("change", function () {
    keyboard.setEnabled(false);
    newDefault = $(".abc-fixed").val();
    dashboard.engine.setConfig({ machine: { manual: { abc_increment: newDefault } } }, function (err, data) {
        if (err) {
            console.log(err);
        } else {
            engine.config.machine.manual.abc_increment = newDefault;
        }
    });
});

$(".axi").on("click", function (e) {
    e.stopPropagation();
    $("#keypad").hide();
    $(".go-to-container").show();
});

$(".axi").on("focus", function (e) {
    in_goto_flag = true;
    e.stopPropagation();
    $(this).val(parseFloat($(this).val().toString()));
    $(this).select();
    keyboard.setEnabled(false);
});

$(".fixed-step-value").on("focus", function (e) {
    e.stopPropagation();
    $(this).select();
    keyboard.setEnabled(false);
});

// manual keypad movement
$(".manual-drive-modal")
    .not(".fixed-step-value")
    .on("click", function (e) {
        $(".posx").val($(".posx").val());
        $(".posy").val($(".posy").val());
        $(".posz").val($(".posz").val());
        $(".posa").val($(".posa").val());
        $(".posb").val($(".posb").val());
        $(".posc").val($(".posc").val());
        in_goto_flag = false;
        $("#keypad").show();
        $(".go-to-container").hide();
        if ($(event.target).hasClass("fixed-step-value")) {
            keyboard.setEnabled(false);
        } else {
            keyboard.setEnabled(true);
        }
    });

$(".axi").keyup(function (e) {
    keyboard.setEnabled(false);
    if (e.keyCode == 13) {
        var move = {};
        $(".modal-axi:visible").each(function () {
            move[$(this).attr("id")] = parseFloat($(this).val());
        });
        dashboard.engine.goto(move);
    }
});

$(".zero-button").on("click", function () {
    var axi = $(this).parent("div").find("input").attr("id");
    var obj = {};
    obj[axi] = 0;
    console.log("zero- ", axi, obj, obj[axi]);
    dashboard.engine.set(obj);
});

$("#connection-strength-indicator").on("click", function (evt) {
    dashboard.launchApp("network-manager");
});

// RIGHT DRO Actions (OUTPUTS, FEEDRATE, SPINDLE-SPEED) .........................................................

// * Note awkward js patterns to get the right API calls to work
// Toggle Outputs
$(".toggle-out").on("click", function (evt) {
    var output = $(this).text(); // get switch number
    var state = $(this).hasClass("on"); // ... and state
    if (state) {
        dashboard.handlers.runSBP("SO, " + output + ", 0", function (err, result) {
            if (err) {
                console.error("An error occurred:", err);
            } else {
                console.log("The result is:", result);
            }
        });
    }
    if (!state) {
        dashboard.handlers.runSBP("SO, " + output + ", 1", function (err, result) {
            if (err) {
                console.error("An error occurred:", err);
            } else {
                console.log("The result is:", result);
            }
        });
    }
});

// Feed Rate (move speed)
var changeFeedRate = function (new_feedrate) {
    if (new_feedrate > 0 && new_feedrate < 1000) {
        dashboard.handlers.runSBP("MS, " + new_feedrate, function (err, result) {
            if (err) {
                console.error("An error occurred:", err);
            } else {
                console.log("The result is:", result);
            }
        });
    }
};
$("#feed-rate").on("change", function (evt) {
    var new_feedrate = parseFloat($("#feed-rate").val());
    changeFeedRate(new_feedrate);
});

// Requested OVERRIDE Feed Rate via setUix process (see uix.js)
var overrideFeedRate = function (new_override) {
    try {
        console.log("----> fr Override Request: " + new_override);
        engine.setUix("fr_override", new_override);
    } catch (error) {
        console.log("Failed to pass new Override: " + error);
    }
};
$("#override").on("change", function (evt) {
    if (engine.status.state != "idle") {
        var new_override = parseFloat($("#override").val());
        if (new_override > 4 && new_override < 201) {
            overrideFeedRate(new_override);
        }
    }
});

// Spindle Speed
var changeSpindleSpeed = function (new_RPM) {
    try {
        console.log("----> new speed: " + new_RPM);
        engine.setAcc("spindle_speed", new_RPM);
    } catch (error) {
        console.log("Failed to pass new RPM: " + error);
    }
};
$(".spindle-speed").on("change", function (evt) {
    var new_RPM = $(".spindle-speed input").val();
    changeSpindleSpeed(new_RPM);
});

// ... get FOCUS out of SPINDLE BOX if done
var blurTimer;
function startBlurTimer() {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(function () {
        // ... but, dont' blur if in the middle of selecting text
        if (!document.activeElement.classList.contains("spindle-speed") && !window.getSelection().toString()) {
            $("#sp-speed").blur();
            $(".spindle-speed input").val(engine.status.spindle.vfdDesgFreq); // reset to current speed
        }
    }, 2000);
}
// Listener for focus on the input box
$("#sp-speed").on("focus", function (evt) {
    startBlurTimer();
});
// Listeners for activity in the input box to restart the timer
$("#sp-speed").on("input keypress mousemove", function (evt) {
    startBlurTimer();
});
// ... get FOCUS out of OVERRIDE BOX if done
var ovBlurTimer;
function startOvBlurTimer() {
    clearTimeout(ovBlurTimer);
    ovBlurTimer = setTimeout(function () {
        $("#override").blur();
    }, 2000);
}
// Listener for focus on the input box
$("#override").on("focus", function (evt) {
    startOvBlurTimer();
});
// Listeners for activity in the input box to restart the timer
$("#override").on("input keypress mousemove", function (evt) {
    startOvBlurTimer();
});

// ENGINE INTERACTIONS ========================================================

engine.on("authentication_failed", function (message) {
    if (message === "not authenticated") {
        window.location = "#/authentication?message=not-authenticated";
    } else if (message === "kicked out") {
        window.location = "#/authentication?message=kicked-out";
    }
});

engine.on("disconnect", function () {
    if (!disconnected) {
        disconnected = true;
        setConnectionStrength(null);
        showDaisy();
    }
});

engine.on("connect", function () {
    if (disconnected) {
        disconnected = false;
        setConnectionStrength(5);
    }
    hideDaisy(null);
    if (consent === "none") {
        showConsent();
    }
});

function setConnectionStrength(level) {
    var onclass = "on";
    if (level === null) {
        level = 4;
        onclass = "err";
    }
    for (i = 1; i < 5; i++) {
        var bar = $("#cs" + i);
        if (i <= level) {
            bar.attr("class", onclass);
        } else {
            bar.attr("class", "off");
        }
    }
}

var signal_window = [];
signal_window = [3, 3, 3, 3, 3]; // preload circular buffer with 4s
var err_count = 0;

function ping() {
    engine.ping(function (err, time) {
        // 5-point Moving average
        signal_window.push(time);
        if (signal_window.length > 5) {
            signal_window.shift(0);
        }
        var sum = 0;
        for (var i = 0; i < signal_window.length; i++) {
            sum += signal_window[i];
        }
        var avg = sum / signal_window.length;

        if (err) {
            console.error(err);
        } else {
            if (avg < 100) {
                setConnectionStrength(4);
            } else if (avg < 200) {
                setConnectionStrength(3);
            } else if (avg < 400) {
                setConnectionStrength(2);
            } else if (avg < 800) {
                setConnectionStrength(1);
            } else {
                setConnectionStrength(0);
            }
        }
        setTimeout(ping, 2000);
    });
}

ping();

engine.sendTime();

function touchScreen() {
    if (supportsTouch && window.innerWidth < 800) {
        $("#app-client-container").css({
            "-webkit-overflow-scrolling": "touch",
            "overflow-y": "scroll",
        });
    }
}
touchScreen();

$(".icon_sign_out").on("click", function (e) {
    e.preventDefault();
    dashboard.showModal({
        title: "Log Out?",
        message: "Are you sure you want to sign out of this machine?",
        okText: "Yes",
        cancelText: "No",
        ok: function () {
            window.location.href = "#/authentication";
        },
        cancel: function () {},
    });
});

//setUpManual();
