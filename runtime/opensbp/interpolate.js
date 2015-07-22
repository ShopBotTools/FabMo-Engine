var fs = require('fs');
var log = require('../../log').logger('sbp');
var g2 = require('../../g2');
var sb3_commands = require('./sb3_commands');
var config = require('../../config');
var opensbp = require('./opensbp');

//  Interpolate_Line - is used to interpolate a line into smaller segments.
//    
//  Usage: lineInterpolate(<EndPt>)
//
exports.lineInterpolate = function(runtime, EndPt) {
log.debug("lineInterpolate: EndPt = " + JSON.stringify(EndPt));
  var startX = runtime.cmd_posx;
  var startY = runtime.cmd_posy; 
  var startZ = runtime.cmd_posz;
  var nextX = startX;
  var nextY = startY;
  var nextZ = startZ;
  var endX = startX;
  if ("X" in EndPt && EndPt.X !== undefined) { endX = EndPt.X;}
  var endY = startY;
  if ("Y" in EndPt && EndPt.Y !== undefined) { endY = EndPt.Y;}
  var endZ = startZ;
  if ("Z" in EndPt && EndPt.Z !== undefined) {
    endZ = EndPt.Z;
    log.debug("Z = " + endZ);
  }    
  var speed = EndPt.F;
  var segLen = config.opensbp.get('cRes');
log.debug("segLen = " + segLen);
  //distance = sqrt[width^2 + length^2 + height^2]
log.debug("startX = " + startX + " startY = " + startY + " startZ = " + startZ );  
log.debug("endX = " + endX + " endY = " + endY + " endZ = " + endZ );  
  var lineLen = Math.sqrt(Math.pow((endX-startX),2)+Math.pow((endY-startY),2)+Math.pow((endZ-startZ),2));
log.debug("lineLen = " + lineLen);
  if ( lineLen === 0 ) { throw( "lineInterpolate: line length zero" ); }
  var steps = Math.floor(lineLen/segLen);
  var stepX = (endX-startX)/steps;
  var stepY = (endY-startY)/steps;
  var stepZ = (endZ-startZ)/steps;
  var gcode = "";
  var level = runtime.transforms.level.apply;
  var PtFilename = runtime.transforms.level.ptDataFile;
  var PtData = "";
  if(level === true){
//    log.debug("lineInterpolation: readPtData");
    PtData = fs.readFileSync(PtFilename);
    PtData = JSON.parse(PtData);
//    log.debug("lineInterpolate: PtData = " + JSON.stringify(PtData));
  }
  for ( i=1; i<steps+1; i++){
      nextPt = {};
      gcode = "G1";

      if ((stepX !== 0)){ nextPt.X = startX + (stepX * i); }
      else{ nextPt.X = runtime.cmd_posx; }

      if (stepY !== 0){ nextPt.Y = startY + (stepY * i); }
      else{ nextPt.Y = runtime.cmd_posy; }

      if (stepZ !== 0){ nextPt.Z = startZ + (stepZ * i); }
      else{ 
        if (level === true) { nextPt.Z = runtime.cmd_posz; }
      }

      if (level === true){ nextPt.Z = leveler(nextPt,PtData); }

      for(var key in nextPt) {
        var v = nextPt[key];
        log.debug(" lineInterpolate v = " + v);
        if(v !== undefined) {
          if(isNaN(v)) { throw( "Invalid " + key + " argument: " + v ); } 
          gcode += (key + v.toFixed(5));
          if(key === "X") { runtime.cmd_posx = v; }
          else if(key === "Y") { runtime.cmd_posy = v; }
          else if(key === "Z") { runtime.cmd_posz = v; }
          else if(key === "A") { runtime.cmd_posa = v; }
          else if(key === "B") { runtime.cmd_posb = v; }
          else if(key === "C") { runtime.cmd_posc = v; }
        }
      }

      gcode += "F" + speed;
      runtime.emit_gcode(gcode);
  }

  return;

};

function leveler(PtNew, data){
    log.debug("leveler data = " + JSON.stringify(data));
    var zA = 0;
    var zB = 0;
    var zP = 0;
    var count = Object.keys(data).length;
    if (count === 4){
      log.debug("leveler_4-point: num keys = " + count);
      zA = data.P1.z + ((data.P2.z-data.P1.z)*((PtNew.X-data.P1.x)/(data.P2.x-data.P1.x)));
      log.debug("leveler: zA = " + zA);
      zB = data.P4.z + ((data.P3.z-data.P4.z)*((PtNew.X-data.P4.x)/(data.P3.x-data.P4.x)));
      log.debug("leveler: zB = " + zB);
      zP = zA - ((zB-zA)*((PtNew.Y-data.P1.y)/(data.P4.y-data.P1.y)));
      log.debug("leveler: zP = " + zP);
      zP += PtNew.Z;
      log.debug("zP = " + zP + "   PtZ = " + PtNew.Z);
      return zP;
    }
    else{
      log.debug("leveler_multi-point: num keys = " + count);

      return PtNew.Z;
      //return zP;
    }
}

//  Interpolate_Circle - is used to interpolate a circle that has uneven proportions as an ellipse.
//    
//  Usage: circleInterpolate(pt);
//

exports.circleInterpolate = function(runtime, code, CGParams) {
log.debug("circleInterpolate: CGParams = " + JSON.stringify(CGParams));
  var startX = runtime.cmd_posx;
  var startY = runtime.cmd_posy;
  var startZ = runtime.cmd_posz;
  log.debug("startX = " + startX + " startY = " + startY);
  var endX = startX;
  if ("X" in CGParams && CGParams.X !== undefined) { endX = CGParams.X; }
  var endY = startY;
  if ("Y" in CGParams && CGParams.Y !== undefined) { endY = CGParams.Y; }
  var plunge = startZ;
  if ("Z" in CGParams && CGParams.Z !== undefined) { plunge = CGParams.Z; }
  var centerX = CGParams.I;
  var centerY = CGParams.J;
  var centerPtX = startX+centerX;
  var centerPtY = startY+centerY;
  var speed = CGParams.F;
  var nextX = 0.0;
  var nextY = 0.0;
  var nextZ = 0.0;

  var SpiralPlunge = 0;
  if ( plunge !== 0 ) { SpiralPlunge = 1; }

  // Find the beginning and ending angles in radians. We'll use only radians from here on.
  var Bang = Math.abs(Math.atan2(centerY, centerX));
  var Eang = Math.abs(Math.atan2((endY-centerPtY),(endX-centerPtX)));

//log.debug("1Bang = " + Bang + "  Eang = " + Eang);

  var inclAng;

  if (code === "G2") {
      if (Eang > Bang) { inclAng  = 6.28318530717959 - (Bang - Eang); }
      if (Bang > Eang) { inclAng = Eang - Bang; }
  }
  else {
      if (Bang < Eang) { inclAng = Eang + Bang; }
      if (Bang > Eang) { inclAng = 6.28318530717959 - (Bang - Eang); }
  }

//log.debug("inclAng = " + inclAng);
//log.debug("2Bang = " + Bang + "  Eang = " + Eang);

  if ( Math.abs(inclAng) < 0.005 ) { 
//      log.debug("Returning from interpolation - arc too small to cut!");
      return;
  }

  var circleTol = 0.001;
  var radius = Math.sqrt(Math.pow(centerX,2)+Math.pow(centerY,2));
  var chordLen = config.opensbp.get('cRes');
  // Sagitta is the height of an arc from the chord
  var sagitta = radius - Math.sqrt(Math.pow(radius,2) - Math.pow((chordLen/2),2));

  if (sagitta !== circleTol) {
      sagitta *= (sagitta/circleTol);
      chordLen = Math.sqrt(2*sagitta*radius-Math.pow(sagitta,2));
      log.debug("chordLen = " + chordLen );
      if (chordLen < 0.001) { chordLen = 0.001; }
  }    

  var theta = Math.asin((0.5*chordLen)/radius) * 2;
  var remain = Math.abs(inclAng) % Math.abs(theta);
  var steps = Math.floor(Math.abs(inclAng)/Math.abs(theta));

  if ((remain) !== 0){
      theta = inclAng/steps;
  }

  var zStep = plunge/steps;
  var nextAng = Bang;
  var gcode = "";

  for ( i=1; i<steps; i++) {
    gcode = "G1";
    nextAng = Bang + (i*theta);
//    log.debug("nextAng = " + nextAng);    
//    log.debug("radius = " + radius);
    runtime.cmd_posx = nextX = centerPtX + (radius * Math.cos(nextAng)); //* propX;
    runtime.cmd_posy = nextY = centerPtY + (radius * Math.sin(nextAng)); //* propY;
    gcode += "X" + nextX.toFixed(5) + "Y" + nextY.toFixed(5);
    if ( SpiralPlunge === 1 ) { 
      runtime.cmd_posz = params.Z = zStep * i;
      gcode += "Z" + nextZ.toFixed(5); 
    }
    gcode += "F" + speed;
//    log.debug("circleInterpolation: gcode = " + gcode);
    runtime.emit_gcode(gcode);
  }
  
  gcode = "G1";
  runtime.cmd_posx = nextX = endX;
  runtime.cmd_posy = nextY = endY;
  gcode += "X" + nextX.toFixed(5) + "Y" + nextY.toFixed(5);
  if ( SpiralPlunge === 1 ) { 
    runtime.cmd_posz = nextZ = plunge;
    gcode += "Z" + nextZ.toFixed(5); 
  }
  log.debug("circleInterpolation: end gcode = " + gcode);
  gcode += "F" + speed;
  runtime.emit_gcode(gcode);

  return;

};

// Triangle Vertex0, 
// Triangle Vertex1, 
// Triangle Vertex2, 
// Point on intersect line, 
// Intersect Line Vector
exports.chkTriangleIntersect = function( V0, V1, V2, O, D )
{
  var EPSILON = 0.000001; 
  //Find vectors for two edges sharing V1
  var edge1 = Math.sub(V1, V0);
  var edge2 = Math.sub(V2, V0);
  //Begin calculating determinant - also used to calculate u parameter
  var Pvec = Math.cross(D, edge2);
  //if determinant is near zero, ray lies in plane of triangle
  var det = Math.dot(edge1, Pvec);
  //NOT CULLING
  if(det > -EPSILON && det < EPSILON) return 0;
  var inv_det = 1 / det;
  //calculate distance from V1 to ray origin
  var Tvec = Math.sub(O, V1);
  //Calculate u parameter and test bound
  var u = Math.dot(Tvec, Pvec) * inv_det;
  //The intersection lies outside of the triangle
  if(u < 0 || u > 1) return 0;
  //Prepare to test v parameter
  var Qvec = Math.cross(Tvec, edge1);
  //Calculate V parameter and test bound
  var v = Math.dot(D, Qvec) * inv_det;
  //The intersection lies outside of the triangle
  if(v < 0 || u + v  > 1) return 0;
  var t = Math.dot(edge2, Qvec) * inv_det;
  if(t > EPSILON) { //ray intersection
    return 1;
  }
  // No hit, no win
  return 0;
};