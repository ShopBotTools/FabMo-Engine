var log = require('../../../log').logger('sbp');
var g2 = require('../../../g2');
var sb3_commands = require('../sb3_commands');
var config = require('../../../config');
/* VALUES */

exports.VA = function(args, callback) {

	log.debug("VA Command: " + args);
	
	this.machine.driver.get('mpo', function(err, MPO) {

		log.debug("Current Machine Base Coordinates (mm): " + JSON.stringify(MPO));

		var setVA_G2 = {};	
		var setVA_SBP = {};	
		var newLocation = 0.0;
		var unitConv = 1.0;

		if ( this.machine.driver.status.unit === 0 ) {  // inches
			unitConv = 0.039370079;
		}

		if (args[0] !== undefined) { 	//X location
			newLocation = Number(((MPO.x * unitConv) - args[0]).toFixed(5));
			setVA_G2.g55x = newLocation;
			this.cmd_posx = this.posx = args[0];
			log.debug("new X = " + newLocation);
		}
		if (args[1] !== undefined) { 	//Y location
			newLocation = Number(((MPO.y * unitConv) - args[1]).toFixed(5));
			setVA_G2.g55y = newLocation;
			this.cmd_posy = this.posy = args[1];
			log.debug("new Y = " + newLocation);	
		}
		if (args[2] !== undefined) { 	//Z location
			newLocation = Number(((MPO.z * unitConv) - args[2]).toFixed(5));
			setVA_G2.g55z = newLocation;
			this.cmd_posz = this.posz = args[2];
			log.debug("new Z = " + newLocation);	
		}
		if (args[3] !== undefined) { 	//A location
			newLocation = Number(((MPO.a * unitConv) - args[3]).toFixed(5));
			setVA_G2.g55a = newLocation;
			this.cmd_posa = this.posa = args[3];
			log.debug("new A = " + newLocation);	
		}
		if (args[4] !== undefined) { 	//B location
			newLocation = Number(((MPO.b * unitConv) - args[4]).toFixed(5));
			setVA_G2.g55b = newLocation;
			this.cmd_posb = this.posb = args[4];
			log.debug("new B = " + newLocation);	
		}
		if (args[5] !== undefined) { 	//C location
			newLocation = Number(((MPO.c * unitConv) - args[5]).toFixed(5));
			setVA_G2.g55c = newLocation;
			this.cmd_posc = this.posc = args[5];
			log.debug("new C = " + newLocation);	
		}
//		if (args[6] !== undefined) { 	//X Base Coordinate
//			newLocation = args[6];
//			log.debug("new X Base Coordinate = " + newLocation);
//			setVA_G2.g54x = newLocation;
//		}
//		if (args[7] !== undefined) { 	//Y Base Coordinate
//			newLocation = args[7];
//			log.debug("new Y Base Coordinate = " + newLocation);
//			setVA_G2.g54y = newLocation;
//		}
//		if (args[8] !== undefined) { 	//Z Base Coordinate
//			newLocation = args[8];
//			log.debug("new Z Base Coordinate = " + newLocation);
//			setVA_G2.g54z = newLocation;
//		}
//		if (args[9] !== undefined) { 	//A Base Coordinate
//			newLocation = args[9];
//			log.debug("new A Base Coordinate = " + newLocation);
//			setVA_G2.g54a = newLocation;
//		}
//		if (args[10] !== undefined) { 	//B Base Coordinate
//			newLocation = args[10];
//			log.debug("new B Base Coordinate = " + newLocation);
//			setVA_G2.g54b = newLocation;
//		}
//		if (args[11] !== undefined) { 	//C Base Coordinate
//			newLocation = args[11];
//			log.debug("new C Base Coordinate = " + newLocation);
//			setVA_G2.g54c = newLocation;
//		}

		config.driver.setMany(setVA_G2, function(err, value) {
			callback();
		}.bind(this));
	}.bind(this));
};

exports.VC = function(args) {

	log.debug( "VC - args = " + args );

	var sbp_values = {};

	if (args[0] !== undefined) { 	//args[0] = sbp_settings.cutterDia	// Cutter Diameter
		sbp_values.cutterDia = args[0];
	}
	// args[1] = Obsolete
	// args[2] = Obsolete
	if (args[3] !== undefined) { 	//Safe Z Pull Up
		sbp_values.safeZpullUp = args[3];		
	}
//	if (args[4] !== undefined) { 	// Plunge Direction
//	}
	if (args[5] !== undefined) { 	// % Pocket Overlap for CR and CG commands
		sbp_values.pocketOverlap = args[5];
	}
	if (args[6] !== undefined) { 	// Safe A Pull Up
		sbp_values.safeApullUp = args[6];
	}
	// args[7] = triggeredOutput		// triggered output switch
	// args[8] = triggerONthreshold		// trigger ON threshold
	// args[9] = triggerOFFthreshold	// trigger OFF threshold
	// args[10] = vertAxisMonitor		// vertical axis monitored
	// args[11] = triggerOutputNum		// triggered output switch #

	config.opensbp.setMany(sbp_values, function(err, values) {
		log.debug( "VC-sbp_values = " + JSON.stringify(sbp_values) );
		callback();
	});
};

exports.VD = function(args,callback) {
	var g2_VD = {};
	if ( args[0] !== undefined ){
		var numAxes = args[0];
		if ( numAxes > 0 || x < 7 ){

		}
	}
	if ( args[1] !== undefined ) {
		var unitType = args[1];
		if ( unitType === 0 || unitType === 1 ){
			if ( unitType === 0 ){
				this.emit_gcode("G20"); // inches
			}
			else {
				this.emit_gcode("G21"); // mm
			}
		}
	}
	// For all axes - the values are:
	//    0=Disable; 1=Standard Mode; 2=Inhibited; 3=Radius Mode
	// X Unit type
	if ( args[2] !== undefined ){
		var x = args[2];
		if ( x >= 0 || x < 4 ){
			g2_VD.xam = x;
		}
	}
	// Y Unit type
	if ( args[3] !== undefined ){
		var y = args[3];
		if ( y >= 0 || y < 4 ){
			g2_VD.yam = y;
		}
	}
	// Z Unit type
	if ( args[4] !== undefined ){
		var z = args[4];
		if ( z >= 0 || z < 4 ){
			g2_VD.zam = z;
		}
	}	
	// A Unit type
	if ( args[5] !== undefined ){
		var a = args[5];
		if ( a >= 0 || a < 4 ){
			g2_VD.aam = a;
		}
	}
	// B Unit type
	if ( args[6] !== undefined ){
		var b = args[6];
		if ( b >= 0 || b < 4 ){
			g2_VD.yam = b;
		}
	}
	// C Unit type
	if ( args[7] !== undefined ){
		var c = args[7];
		if ( c >= 0 || c < 4 ){
			g2_VD.cam = c;
		}
	}	
	// Show control console
	// Display File Comments
	// Keypad fixed distance
	// Keypad remote
	// Keypad Switch AutoOff
	// Write Part File Log
	// Write System File Log
	// Message Screen Location X
	// Message Screen Location Y
	// Message Screen Size X
	// Message Screen Size Y
	// Keypad switches Auto-Off
	// Show file Progress
	// Main Display Type
	config.driver.setMany(g2_VD, function(err, values) {
		callback();
	});

};	

exports.VI = function(args,callback) {
	var g2_VI = {};

	// Driver 1 Channel
	if ( args[0] !== undefined ){
		if ( args[0] > 0 || args[0] < 6 ){
			g2_VI['1ma'] = args[0];
		}
		else {}
	}
	// Driver 2 Channel
	if ( args[1] !== undefined ){
		if ( args[1] > 0 || args[1] < 6 ){
			g2_VI['2ma'] = args[1];
		}
		else {}
	}
	// Driver 3 Channel
	if ( args[2] !== undefined ){
		if ( args[2] > 0 || args[2] < 6 ){
			g2_VI['3ma'] = args[2];
		}
		else {}
	}
	// Driver 4 Channel
	if ( args[3] !== undefined ){
		if ( args[3] > 0 || args[3] < 6 ){
			g2_VI['4ma'] = args[3];
		}
		else {}
	}
	// Driver 5 Channel
	if ( args[4] !== undefined ){
		if ( args[4] > 0 || args[4] < 6 ){
			g2_VI['5ma'] = args[4];
		}
		else {}
	}
	// Driver 6 Channel
	if ( args[5] !== undefined ){
		if ( args[5] > 0 || args[0] < 6 ){
			g2_VI['1ma'] = args[0];
		}
		else {}
	}
	config.driver.setMany(g2_VI, function(err, values) {
		callback();
	});

};	

exports.VL = function(args,callback) {

	var g2_VL = {};
	
	// X - Low Limit
	if (args[0] !== undefined){
		g2_VL.xtn = args[0];
	}
	// X - High Limit
	if (args[1] !== undefined){
		g2_VL.xtm = args[1];
	}
	// Y - Low Limit
	if (args[2] !== undefined){
		g2_VL.ytn = args[2];
	}
	// Y - High Limit
	if (args[3] !== undefined){
		g2_VL.ytm = args[3];
	}
	// Z - Low Limit
	if (args[4] !== undefined){
		g2_VL.ztn = args[4];
	}
	// Z - High Limit
	if (args[5] !== undefined){
		g2_VL.ztm = args[5];
	}
	// A - Low Limit
	if (args[6] !== undefined){
		g2_VL.atn = args[6];
	}
	// A - High Limit
	if (args[7] !== undefined){
		g2_VL.atm = args[7];
	}
	// Soft limit checking ON-OFF

	// B - Low Limit
	if (args[9] !== undefined){
		g2_VL.btn = args[9];
	}
	// B - High Limit
	if (args[10] !== undefined){
		g2_VL.btm = args[10];
	}
	// Number of axes limits to check
	
	// C - Low Limit
	if (args[12] !== undefined){
		g2_VL.ctn = args[12];
	}
	// C - High Limit
	if (args[13] !== undefined){
		g2_VL.ctm = args[13];
	}
	
	config.driver.setMany(g2_VL, function(err, values) {
		callback();
	});

};	

exports.VN = function(args) {
		// Limits 0-OFF, 1-ON
		// Input #4 Switch mode 0-Nrm Closed Stop, 1-Nrm Open Stop, 2-Not Used 
		// Enable Torch Height Controller, Laser or Analog Control
		//		0-Off, 1-Torch, 2-Laser, 3-An1 Control, 4-An2 Control, 5-An1 & An2 Control
	
	// Input Switch Modes = 0-Standard Switch, 1-Nrm Open Limit, 2-Nrm Closed Limit, 3-Nrm Open Stop, 4-Nrm Closed Stop
		// Input #1 Switch mode
		// Input #2 Switch mode
		// Input #3 Switch mode
		// Input #5 Switch mode
		// Input #6 Switch mode
		// Input #7 Switch mode	
		// Input #8 Switch mode
		// Input #9 Switch mode
		// Input #10 Switch mode
		// Input #11 Switch mode
		// Input #12 Switch mode
	// Output Switch Modes = 0-StdON/FileOFF, 1-StdON/NoOFF, 2-StdON/LIStpOFF, 3-AutoON/FileOFF, 4-AutoON/NoOFF, 5-AutoON/FIStpOFF
		// Output #1 Mode 
		// Output #2 Mode
		// Output #3 Mode
		// Output #5 Mode
		// Output #6 Mode
		// Output #7 Mode
		// Output #8 Mode
		// Output #9 Mode
		// Output #10 Mode
		// Output #11 Mode
		// Output #12 Mode

};	

exports.VP = function(args) {
	// Grid
	// Table Size X
	// Table Size Y
	// Table Size Z
	// Simulate Cutting
	// Draw Tool
	// Start Actual Location
	// Show Jugs

};	

exports.VR = function(args, callback) {
	var VRset = {};
	// XY Move Ramp Speed
	if (args[0] !== undefined) {
		VRset.xjm = args[0];
		VRset.yjm = args[0]; 
	}
	// Z Move Ramp Speed
	if (args[1] !== undefined) { 
		VRset.zjm = args[1];
		} 
	// A Move Ramp Speed
	if (args[2] !== undefined) { 
		VRset.ajm = args[2];
		} 
	// B Move Ramp Speed
	if (args[3] !== undefined) { 
		VRset.bjm = args[3];
	}
	// C Move Ramp Speed
	if (args[4] !== undefined) {
		VRset.cjm = args[4];
		} 

//	config.opensbp.setMany(sbp_VU, function(err, values) {
	config.driver.setMany(VRset, function(err, values) {
		log.debug("Sent VR to g2 and sbp_settings");
		callback();
	});
//	});

};	

exports.VS = function(args,callback) {
	
	var speed_change = 0.0;

	var g2_values = {};
	var sbp_values = {};

	if (args[0] !== undefined) {
		speed_change = args[0];
//		g2_values.xfr = (60*speed_change);
//		g2_values.yfr = (60*speed_change);
		sbp_values.movexy_speed = speed_change;
	}
	if (args[1] !== undefined) {
		speed_change = args[1];
//		g2_values.zfr = (60*speed_change);
		sbp_values.movez_speed = speed_change;
	}
	if (args[2] !== undefined) {
		speed_change = args[2];
//		g2_values.afr = (60*speed_change);
		sbp_values.movea_speed = speed_change;
	}
	if (args[3] !== undefined) {
		speed_change = args[3];
//		g2_values.bfr = (60*speed_change);
		sbp_values.moveb_speed = speed_change;
	}
	if (args[4] !== undefined) {
		speed_change = args[4];
//		g2_values.cfr = (60*speed_change);
		sbp_values.movec_speed = speed_change;
	}
	if (args[5] !== undefined) {
		speed_change = args[5];
		g2_values.xvm = (60*speed_change);
		g2_values.yvm = (60*speed_change);
		sbp_values.jogxy_speed = speed_change;
	}
	if (args[6] !== undefined) {
		speed_change = args[6];
		g2_values.zvm = (60*speed_change);
		sbp_values.jogz_speed = speed_change;
	}
	if (args[7] !== undefined) {
		speed_change = args[7];
		g2_values.avm = (60*speed_change);
		sbp_values.joga_speed = speed_change;
	}
	if (args[8] !== undefined) {
		speed_change = args[8];
		g2_values.bvm = (60*speed_change);
		sbp_values.jogb_speed = speed_change;
	}
	if (args[9] !== undefined) {
		speed_change = args[9];
		g2_values.cvm = (60*speed_change);
		sbp_values.jogc_speed = speed_change;
	}

	config.opensbp.setMany(sbp_values, function(err, values) {
		if(err) {
			log.error(err);
		}
		config.driver.setMany(g2_values, function(err, values) {
			callback();
		});
	});

};

exports.VU = function(args,callback) {

	var G2_2get = [	'1sa','1mi',
					'2sa','2mi',
					'3sa','3mi',
					'4sa','4mi',
					'5sa','5mi',
					'6sa','6mi' ];

	var SBP_2get = ['gearBoxRatio1',
				    'gearBoxRatio2',
				    'gearBoxRatio3',
				    'gearBoxRatio4',
				    'gearBoxRatio5',
				    'gearBoxRatio6' ];

	var SBunitVal = 0.0;
	var g2_VU = {};
	var sbp_VU = {};
	var getG2_VU = config.driver.getMany(G2_2get);
	var getSBP_VU = config.opensbp.getMany(SBP_2get);

	log.debug("getG2_VU: " + JSON.stringify(getG2_VU));
	log.debug("getSBP_VU: " + JSON.stringify(getSBP_VU));
			
	// Channel 1 unit value
	if (args[0] !== undefined){
		sbp_VU.units1 = args[0];
		g2_VU['1tr'] = (360/getG2_VU['1sa']) * getG2_VU['1mi'] * getSBP_VU.gearBoxRatio1 / sbp_VU.units1;
	}
	// Channel 2 unit value
	if (args[1] !== undefined){
		sbp_VU.units2 = args[1];
		g2_VU['2tr'] = (360/getG2_VU['2sa']) * getG2_VU['2mi'] * getSBP_VU.gearBoxRatio2 / sbp_VU.units2;
	}
	// Channel 3 unit value
	if (args[2] !== undefined){
		sbp_VU.units3 = args[2];
		g2_VU['3tr'] = (360/getG2_VU['3sa']) * getG2_VU['3mi'] * getSBP_VU.gearBoxRatio3 / sbp_VU.units3;
	}
	// Channel 4 unit value
	if (args[3] !== undefined){
		sbp_VU.units4 = args[3];				
		g2_VU['4tr'] = (360/getG2_VU['4sa']) * getG2_VU['4mi'] * getSBP_VU.gearBoxRatio4 / sbp_VU.units4;
	}
	// Channel 5 unit value
	if (args[4] !== undefined){
		sbp_VU.units5 = args[4];
		g2_VU['5tr'] = (360/getG2_VU['5sa']) * getG2_VU['5mi'] * getSBP_VU.gearBoxRatio5 / sbp_VU.units5;
	}
	// Channel 6 unit value
	if (args[5] !== undefined){
		sbp_VU.units6 = args[5];
		g2_VU['6tr'] = (360/getG2_VU['6sa']) * getG2_VU['6mi'] * getSBP_VU.gearBoxRatio6 / sbp_VU.units6;
	}
	// Channel 1 multiplier
	if (args[6] !== undefined){}
	// Channel 2 multiplier
	if (args[7] !== undefined){}
	// Channel 3 multiplier
	if (args[8] !== undefined){}
	// Channel 4 multiplier
	if (args[9] !== undefined){}
	// Channel 5 multiplier
	if (args[10] !== undefined){}
	// Channel 6 multiplier
	if (args[11] !== undefined){}

	log.debug('!!!!');
	log.debug(JSON.stringify(sbp_VU));
	log.debug(JSON.stringify(g2_VU));	

	// We set the g2 config (Which updates the g2 hardware but also our persisted copy of its settings)
	config.opensbp.setMany(sbp_VU, function(err, values) {
		config.driver.setMany(g2_VU, function(err, values) {
			log.debug("Sent VU to g2 and sbp_settings");
			log.debug(value);
			callback();
		});
	});
};
