/*
 * Initialization
 */

var map;
var geocoder;
var directions;

var marker            = null;
var directions_query  = '';

var route_count       = 0;
var route_list        = [];
var route_menu_lookup = {};
var route_menu_list   = [];

var overlays_toggled = {};
var menu_proto = [ 
    null, // used to show what the location is
    $.contextMenu.separator, 
    { 'Directions from here': menuaction_directions_here },
    { 'Directions to here':   menuaction_directions_here },
    { 'Place Waypoint':       menuaction_place_waypoint  } 
  ]; 

var temp = 0;
var temp_overlays = [];

/*
 * Page initialization
 */

$(function() {
  window_event_resize();
  window.onresize = window_event_resize;

// Menus      
  $('#map_canvas').contextMenu(
    contextmenu_event_show,
    {theme:'vista'}
  );

// Setup the map view
  if (GBrowserIsCompatible()) {
    map        = new GMap2(document.getElementById("map_canvas"));
    geocoder   = new GClientGeocoder();
    directions = new GDirections();

    map.setCenter(new GLatLng(CFG["defaults"]["map_center"][0],CFG["defaults"]["map_center"][1]),CFG["defaults"]["map_zoom"]);
    map.setUIToDefault();

    GEvent.addListener( directions, "load", directions_event_load );
  };

});

/*
 * Actions
 */

function direction_search ( dir_a, dir_b, dir_type ) {
// --------------------------------------------------
// Seek direction information based upon the A, B, and
// type fields
//
    var map = top.display.map;
    directions_query = "from: " + dir_a + " to: " + dir_b,
    directions.load(
        directions_query,
        {
            travelMode: G_TRAVEL_MODE_DRIVING,
            getPolyline: true,
            getSteps: true
        }
    );
}

/*
 * Event Handling
 */

function contextmenu_event_show (cmenu,t,e) {
// --------------------------------------------------
  var pixel        = new GPoint(e.pageX, e.pageY);
  var latlon       = map.fromContainerPixelToLatLng(pixel);
  var latlon_str   = sprintf( "%.05f,%.05f", latlon.lng(), latlon.lat() );
  var option_first = {};

// Add the base options in
  option_first[latlon_str] = function(menuItem,menu) {  
    window.prompt(
        "Location Coordinates (longitude,latitude)",
        latlon.lng()+","+latlon.lat()
    )
  };
  menu_proto[0] = option_first;
  var menu_full = menu_proto.slice();

// If the user has right clicked while on a route, let's add that in too
  var routes_hovered = 0;
  for (i in route_menu_lookup ) {

// Add a separator if it's the first entry
    if ( routes_hovered == 0 )
      menu_full.push($.contextMenu.separator);

// Add a menu item
    var route_info = route_menu_lookup[i];
    var menu_new = {};
    menu_new[route_info.query] = function(){};
    menu_full.push(menu_new);

    routes_hovered++;
  }

  return menu_full;
}

function window_event_resize () {
// --------------------------------------------------
  $('.fill_page').css("width",window.innerWidth)
                 .css("height",window.innerHeight);
}

function directions_event_load () {
// --------------------------------------------------
// When directions get loaded
//
  var route_count = directions.getNumRoutes();
  var route_info  = directions.getRoute(0);
  var route_trace = directions.getPolyline();
  var map_zoom    = map.getZoom();
  var summary     = directions.getSummaryHtml();

// Draw the route
  var route_id = route_count;
  route_lookup_rec = {
    route_id:        route_id,
    route_info:      route_info,
    route_trace:     route_trace,
    route_copyright: directions.getCopyrightsHtml(),
    map_zoom:        map_zoom,
    summary:         summary,
    query:           directions_query
  };
  route_list.push(route_lookup_rec);

// We can now calculate the boundaries for each edge in this route.
//  var edge_boundaries = route_boundary_define( map, route_lookup_rec, 10 );
//  route_lookup_rec["edge_boundaries"] = edge_boundaries;

// We want to know when the mouse enters, or leaves a route
// so that we can add the route information to the context menu
// should the user right click
  route_lookup_rec["listen_mouseover"] = GEvent.addListener( 
    route_trace, 
    'mouseover', 
    function() {
      document.body.style.cursor = 'hand';
      route_menu_lookup[route_id] = route_lookup_rec;
      route_menu_list++;
    } 
  );
  route_lookup_rec["listen_mouseout"] = GEvent.addListener( 
    route_trace, 
    'mouseout',  
    function() {
      document.body.style.cursor = 'default';
      delete route_menu_lookup[route_id];
      route_menu_list
    } 
  );

// While the mouse is overtop of this item, we want to 
// position a node dot to show that we can move things 
// around
  route_lookup_rec["listen_mousemove"] = GEvent.addListener(
    map,
    'mousemove',
    function(latlon) {

//        $('#debug').val(temp++);
//        var routes_hovered = 0;
//        return;

// Remove previously laid overlays
        debug_log("");
        for (; temp_overlays.length;) {
            debug_log("removed overlay");
            map.removeOverlay(temp_overlays.shift());
        }

// If we're hovering over a route, let's find the point that's
// closest to an edge and mark it with a vertex manipulator
        var route_matches = 0;
        for (var i=0; i<route_list.length;i++) {
          var route_data = route_list[i];
          var edge_best  = route_locate_edge( map, route_data, latlon );
          if ( edge_best ) {
            route_matches++;
          }
         }
         debug_log((temp++)+":"+(route_matches?"yes":"no"));
         debug_log("Matches:"+route_matches);

        return;
    }
  );

// We capture the click event for... um... not sure. We'll need
// to support drag instead!
  route_lookup_rec["listen_click"] = GEvent.addListener( 
    route_trace, 
    'click',     
    function(latlon) {
      var divcoord = map.fromLatLngToContainerPixel(latlon);
      debug_log("Clicked at: " + divcoord.x+","+divcoord.y );
    } 
  );
  route_count++;

// Send the route to the route store for our use

//  route_trace.enableEditing();

// kind of like line drawing
//  route_trace.enableDrawing();

  map.addOverlay(route_trace);

  return;
}

function route_boundary_define ( map, route_data, leeway ) {
// --------------------------------------------------
// Creates the boundary test values for the route
// provided
//
    var route_trace = route_data["route_trace"];
    var route_boundaries = [];

// At this point, we can start hunting for edges that
// may be close to the x,y coordinate we seek
    var edge_boundaries      = [];
    var point_prev           = route_trace.getVertex(0);
    var route_trace_vertices = route_trace.getVertexCount();
//$('#debug').val("");
    for ( var i = 1; i < route_trace_vertices; i++ ) {

// Create a bounding box
// We actually don't know which point is higher/lower or
// left/right. 
        var point_cur = route_trace.getVertex(i);

// Find out the slope
        var start_pt  = map.fromLatLngToContainerPixel(point_prev);
        var end_pt    = map.fromLatLngToContainerPixel(point_cur);
        var rise      = end_pt.y - start_pt.y;
        var run       = end_pt.x - start_pt.x;
        var r         = leeway; // number of pixels of leeway for snapping

// We will account for cases where the points are straight
// sideways or straight left or right
        var boundary_data = null;
        if ( rise == 0 && run == 0 ) {
        }

// If the edge is flat
        else if ( rise == 0 ) {
        }

// If the edge is vertical
        else if ( run == 0 ) {
        }

// So this edge actually has a slope, let'
        else {

            var slope = rise / run;
            var theta = Math.atan2( rise, Math.abs(run) );
            var B     = leeway / Math.cos(theta);

debug_log( start_pt.x+","+start_pt.y +" -> "+ end_pt.x+","+end_pt.y );
debug_log( "Rise:"  + rise  + " Run:" + run );
debug_log( "Slope:" + slope + " B:"   + B   );

/*********************************************************************************************************/
/*********************************************************************************************************/

// Bottom point.y > y
var f = function( s, e, x ) {
// --------------------------------------------------
    var y = (x-s.x)*slope+B+s.y
debug_log( "PT: " + x+","+y );
    var p = new GPoint( x, y );
    var c = map.fromContainerPixelToLatLng(p);
    return c;
};
var glatlng_start = f(start_pt,end_pt,start_pt.x);
var glatlng_end   = f(start_pt,end_pt,end_pt.x);
var polyline = new GPolyline([glatlng_start,glatlng_end],"#ff0000",2);
map.addOverlay(polyline);

// Top point.y < y
var g = function ( s, e, x ) {
    var y = (x-s.x)*slope-B+s.y
    var p = new GPoint( x, y );
    var c = map.fromContainerPixelToLatLng(p);
    return c;
};
glatlng_start = g(start_pt,end_pt,start_pt.x);
glatlng_end   = g(start_pt,end_pt,end_pt.x);
polyline = new GPolyline([glatlng_start,glatlng_end],"#ff0000",2);
map.addOverlay(polyline);

//  Left? point.y > y
slope *= -1;
var h = function ( s, e, x ) {
    var y = (x-s.x)/slope+s.y
    var p = new GPoint( x, y );
    var c = map.fromContainerPixelToLatLng(p);
    return c;
};
glatlng_start = h(start_pt,end_pt,start_pt.x);
glatlng_end   = h(start_pt,end_pt,end_pt.x);
polyline = new GPolyline([glatlng_start,glatlng_end],"#00ffff",2);
map.addOverlay(polyline);

// Right? point.y < y
var i = function ( s, e, x ) {
    var y = (x-e.x)/slope+e.y
    var p = new GPoint( x, y );
    var c = map.fromContainerPixelToLatLng(p);
    return c;
};
glatlng_start = i(start_pt,end_pt,start_pt.x);
glatlng_end   = i(start_pt,end_pt,end_pt.x);
polyline = new GPolyline([glatlng_start,glatlng_end],"#ff0000",2);
map.addOverlay(polyline);


/*********************************************************************************************************/
/*********************************************************************************************************/

            boundary_data = {
                edge: i,
                start_pt: start_pt,
                end_pt:   end_pt
            };
            boundary_data["bottom"] = function ( start_pt, end_pt, point ) { 
                return point.y > (point.x-start_pt.x)*slope+B+start_pt.y; 
            };
            boundary_data["top"]    = function ( start_pt, end_pt,point ) { 
                return point.y < (point.x-start_pt.x)*slope-B+start_pt.y; 
            };
            if (run < 0) slope *= -1;
            boundary_data["left"]   = function ( start_pt, end_pt,point ) {
                return point.y < (point.x-start_pt.x)/slope+start_pt.y;
            };
            boundary_data["right"]   = function ( start_pt, end_pt,point ) {
                var y = (point.x-end_pt.x)/slope+end_pt.y;
                return point.y > y;
            };
        }

        edge_boundaries.push( boundary_data );

// Does the bounding box fit? We do this in two parts to short circuit if we can
        point_prev = point_cur;
    }

    return edge_boundaries;
}

function route_locate_edge ( map, route_data, latlon ) {
// --------------------------------------------------
// Given a route and X, Y coordinates, this
// function will attempt to place the X,Y coordinates
// onto the edge using bounding boxes and then distance 
// calculations
//

    var route_trace          = route_data["route_trace"];
    var edge_boundaries      = route_lookup_rec["edge_boundaries"];
    var route_trace_vertices = route_trace.getVertexCount();
    var point                = map.fromLatLngToContainerPixel(latlon);

    if ( marker ) {
        map.removeOverlay(marker);
        marker = null;
    }

//$('#debug').val( "" + (temp++) + "\n" );
    var point_prev           = map.fromLatLngToContainerPixel(route_trace.getVertex(0));
    var route_trace_vertices = route_trace.getVertexCount();
    for ( var i=1; i < route_trace_vertices; i++ ) {
        var point_cur = map.fromLatLngToContainerPixel(route_trace.getVertex(i));
        var point_median = edge_click_within( point_prev, point_cur, point, 10 );
        if (point_median) {
            var latlng_median = map.fromContainerPixelToLatLng(point_median);
            var gicon = new GIcon({
                image: "css/images/route-control-point.png",
                iconSize: new GSize(10,10),
                iconAnchor: new GPoint(5,5)
            });
            marker = new GMarker( 
                            latlng_median, 
                            {
                                icon:gicon,
                                draggable: true
                            } 
                        );
            var overlay = map.addOverlay(marker);

            return 1;
        }
        point_prev = point_cur;
    }

    return;
}

function route_locate_edge2 ( map, route_data, latlon ) {
// --------------------------------------------------
// Given a route and X, Y coordinates, this
// function will attempt to place the X,Y coordinates
// onto the edge using bounding boxes and then distance 
// calculations
//

    var route_trace = route_data["route_trace"];
    var route_trace_vertices = route_trace.getVertexCount();

// At this point, we can start hunting for edges that
// may be close to the x,y coordinate we seek
    var edges_matched = [];
    var point_prev    = route_trace.getVertex(0);
    for ( var i = 1; i < route_trace_vertices; i++ ) {

// Create a bounding box
// We actually don't know which point is higher/lower or
// left/right. 
        var point_cur = route_trace.getVertex(i);

// Does the bounding box fit? We do this in two parts to short circuit if we can
        if ( point_prev.distanceFrom(point_cur) > 0 ) {
        if ( in_bounds(latlon.lat(),point_prev.lat(),point_cur.lat(),.5,180) ) {
        if ( in_bounds(latlon.lng(),point_prev.lng(),point_cur.lng(),.5,360) ) {
            edges_matched.push([
                point_prev, // index: 0
                point_cur,  //        1
                i           //        2 current edge id
            ]);
        }}}

// Now the process intensive calculations where we 
// try and locate the perpendicular distance of x, y
// from the edge we've just identified
        point_prev = point_cur;

    }

    if ( edges_matched.length == 0 ) return;

/*            end
 *           /|
 *          / | B
 *      A  /  |
 *        /  _clickpt
 *       / _/
 *  start/   C
 *
 *   A: length of edge
 *   B: distance between end point and click point
 *   C: distance between start point and click point
 *   H: (not marked) distance of click point from edge
 *
 *   Formulas from:
 *    http://softsurfer.com/Archive/algorithm_0101/algorithm_0101.htm
 *    area = .25 * sqrt( 4*a^2*b^2 - (a^2+b^2-c^2)^2 )
 *    H    = area * 2 / A
 *
 *   So:
 *    H    = .5 * sqrt( 4*a^2*b^2 - (a^2+b^2-c^2)^2 ) / A
 */

// Now, we'll go through each of the edges and find the one
// that is the nearest
  for ( var i in edges_matched ) {
    var edge     = edges_matched[i];
    var start_pt = edge[0];
    var end_pt   = edge[1];
    var a = start_pt.distanceFrom( end_pt );
    var b = end_pt.distanceFrom( latlon );
    var c = start_pt.distanceFrom( latlon );

    var h = .5 * Math.sqrt(
                4 * a*a*b*b
                - Math.pow( a*a + b*b - c*c, 2 )
            ) / a;
    var s = b + c;

// Now load up the values for sorting
    edge.push(
      h, // index: 3 (see above)
      a, //        4
      b, //        5
      c, //        6
      s  //        7
    );
  }

// Now let's sort the edges for best match
  edges_matched.sort(function(a,b){
    return a[7] - b[7];
  });

// Return the edge that the user was nearest to
  var edge_best = edges_matched[0];

/*
  var l = "";
  for (var i in edges_matched) {
    l += edges_matched[i][2] 
          + " H:" +  edges_matched[i][3] 
          + " A:" +  edges_matched[i][4] 
          + " B:" +  edges_matched[i][5] 
          + " C:" +  edges_matched[i][6] 
          + "\n";
  }
  $('#debug').val(l);
  */

/*
 * Now, we want to identify the point on the edge
 * that is best match for the user. Since we know
 * H as well as C, we can find out how far along 
 * A we have travelled using rearranging the pythagorean
 * equation
 *
 * c^2 = apartial^2 + h^2
 * apartial = sqrt(c^2 - h^2)
 *
 * This will yield a GLatLng point that can be used
 * to place a marker on the edge for dragging or 
 * whatever
 *
 */
  var start_pt = edge_best[0];
  var end_pt   = edge_best[1];
  var h        = edge_best[3];
  var a        = edge_best[4];
  var c        = edge_best[6];
  var apartial = Math.sqrt( Math.abs( c*c - h*h ) );
  var aratio   = apartial / a;
  var aplat    = start_pt.lat() + ( end_pt.lat() - start_pt.lat() ) * aratio;
  var aplng    = start_pt.lng() + ( end_pt.lng() - start_pt.lng() ) * aratio;
  var appt     = new GLatLng(aplat,aplng);
  edge_best.unshift( appt );
//  edge_best.unshift( start_pt );

  return edge_best;
}

function in_bounds ( v, a, b, pad, wrap ) {
// --------------------------------------------------
// Assuming that the world wraps at 360degrees,
// let's just check to see if the value "v"
// is between the values a and b
//

    var l = a < b ? a : b; // lesser
    var g = a < b ? b : a; // greater
    var d = Math.abs( a-b );

// We will need to wrap
    if ( d > wrap / 2 )  {
        l += wrap;
        var t = l;
        l = g;
        g = t;
        v += wrap;
    }

// Now let's test the bounds and return a true
// value if it's okay
    return ((l-pad) < v && v < (g+pad));
}

/*
 * Menu Functions
 */

function menuaction_directions_here (menu_item,menu) {
// --------------------------------------------------
  alert(menu_item);
}

function menuaction_place_waypoint(menu_item,menu) {
// --------------------------------------------------
  alert(menu_item);
}

/*
 * Basic Functions
 */


function overlay_toggle ( overlay_name ) {
// --------------------------------------------------
// Turns on and off overlays on the map
//

// Turn off?
  if ( overlays_toggled[overlay_name] ) {
    var overlay = overlays_toggled[overlay_name];
    overlays_toggled[overlay_name] = null;
    map.removeOverlay(overlay);
  }

// Turn on
  else {
    var overlay;
    if ( overlay_name == "streetview" ) {
        overlay = new GStreetviewOverlay();
    }
    else if ( overlay_name == "wikipedia" ) {
        overlay = new GLayer("org.wikipedia.en");
    }
    else if ( overlay_name == "panoramio" ) {
        overlay = new GLayer("com.panoramio.all");
    }
    else if ( overlay_name == "webcams" ) {
        overlay = new GLayer("com.google.webcams");
    }
    else if ( overlay_name == "traffic" ) {
        overlay = new GTrafficOverlay({incidents: true});
    }
    else if ( overlay_name == "videos" ) {
        overlay = new GLayer("com.youtube.all");
    }
    if ( overlay ) {
      overlays_toggled[overlay_name] = overlay;
      map.addOverlay(overlay);
    }
  }
}

function debug_log ( msg ) {
// --------------------------------------------------
    if ( msg == "" ) {
        $('#debug').val("");
    }
    else {
        $('#debug').val( $('#debug').val() + msg + "\n" );
    }
}

function edge_click_within ( start_pt, end_pt, click_pt, r ) {
// --------------------------------------------------
// Given two vertexes and a click point, this function 
// will return a true value if the click is found to be 
// within the allowed ranges of the edge. Note that
// all the points should be of GPoint using the same axis
//
    var rise      = end_pt.y - start_pt.y;
    var run       = end_pt.x - start_pt.x;

    if ( rise == 0 ) {
        if ( run == 0 ) {
        }
        return;
    }
    else if ( run == 0 ) {
        return;
    }

// If there is a slope and not a perfectly flat
// or vertical line
    var slope = rise / run;
    var theta = Math.atan2( rise, Math.abs(run) );
    var B     = r / Math.cos(theta);

    var click_x = click_pt.x;
    var click_y = click_pt.y;
    var v = (click_x-start_pt.x)*slope+start_pt.y;
    if (click_y>v+B) return;
    if (click_y<v-B) return;

    var slope_v = slope * -1;

    if ( rise > 0 ) {
        if ( click_y < (click_x-start_pt.x)/slope_v+start_pt.y ) return;
        if ( click_y > (click_x-end_pt.x)/slope_v+end_pt.y )     return;
    }
    else {
        if ( click_y > (click_x-start_pt.x)/slope_v+start_pt.y ) return;
        if ( click_y < (click_x-end_pt.x)/slope_v+end_pt.y )     return;
    }

/*
 * Lets reply back with an X,Y point that relates to where
 * on the line segment the user is closest to (on a perpendicular
 * basis)
 *            end
 *           /|
 *          / | B
 *      A  /  |
 *        /  _clickpt
 *       / _/
 *  start/   C
 *
 *   A: length of edge
 *   B: distance between end point and click point
 *   C: distance between start point and click point
 *   H: (not marked) distance of click point from edge
 *
 *   Formulas from:
 *    http://softsurfer.com/Archive/algorithm_0101/algorithm_0101.htm
 *    area = .25 * sqrt( 4*a^2*b^2 - (a^2+b^2-c^2)^2 )
 *    H    = area * 2 / A
 *
 *   So:
 *    H    = .5 * sqrt( 4*a^2*b^2 - (a^2+b^2-c^2)^2 ) / A
 */
    var a = Math.sqrt(rise*rise+run*run);
    var vx = click_x - end_pt.x;
    var vy = click_y - end_pt.y;
    var b = Math.sqrt(vx*vx+vy*vy);
        vx = click_x - start_pt.x;
        vy = click_y - start_pt.y;
    var c = Math.sqrt(vx*vx+vy*vy);

    var h = .5 * Math.sqrt(
                4 * a*a*b*b
                - Math.pow( a*a + b*b - c*c, 2 )
            ) / a;

// At this point, it's possible to calculate the distance 
// from start that the perpendicular intercept from the clickpt
// will cross
    var ai = c * Math.sin(Math.acos(h/c));
    var p  = ai / a;
    var nx = start_pt.x + run * p;
    var ny = start_pt.y + rise * p;
    var np = new GPoint( nx, ny );
    return np;
}

