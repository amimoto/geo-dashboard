/*
 * Initialization
 */

var map;
var geocoder;
var directions;

var state_dragging    = null;
var marker_dragging   = null;
var directions_query  = '';

// We keep track of the routes that are currently active
// on the map through the following variables
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

// Setup the map view if we can....
  if (GBrowserIsCompatible()) {
    map        = new GMap2(document.getElementById("map_canvas"));
    geocoder   = new GClientGeocoder();
    directions = new GDirections();

// Create a map and let's try and center it...
    map.setCenter(
        new GLatLng(CFG["defaults"]["map_center"][0],
                    CFG["defaults"]["map_center"][1]),
                    CFG["defaults"]["map_zoom"]
    );
    map.setUIToDefault();

// When we successfully load some direcitons
    GEvent.addListener( directions, "load", directions_event_load );

    GEvent.addListener( map, "dragstart", 
        function () {
            debug_log("map dragging");
        }
    );
    
    GEvent.addListener( map, "dragend", 
        function () {
            debug_log("map moved");
        }
    );

// Let's try and load the new object
    var g = new route_directions({
        map: map,
        callback: function (me) {
            me.polyline.show();
        }
    });
    g.search(['vancouver','west vancouver']);

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
    route_placemarks: [],
    map_zoom:        map_zoom,
    summary:         summary,
    query:           directions_query
  };
  route_list.push(route_lookup_rec);

// DEBUG
    debug_log(route_trace.getVertexCount());
    debug_log("Markers:");

    var my_marker;
    var i = 0;
    while ( my_marker = directions.getMarker(i) ) {

        var placemark = directions.getGeocode(i);
        route_lookup_rec["route_placemarks"].push(placemark);

// Add the tie point to the route
        map.addOverlay(my_marker);

        i++;
    }

// We want to know when the mouse enters, or leaves a route
// so that we can add the route information to the context menu
// should the user right click

/* Temporarily removed
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
*/

// While the mouse is overtop of this item, we want to 
// position a node dot to show that we can move things 
// around
  route_lookup_rec["listen_mousemove"] = GEvent.addListener(
    map,
    'mousemove',
    function(latlon) {

// Ignore if we're dragging
        if ( state_dragging ) return;

// If we're hovering over a route, let's find the point that's
// closest to an edge and mark it with a vertex manipulator
        for (var i=0; i<route_list.length;i++) {
          var route_data = route_list[i];
          var point_median  = route_locate_edge( map, route_data, latlon );

// If the point_median is set, this means that there's an edge that's close
// and we now have a starting coordinate for this point
          if ( point_median ) {
            var latlng_median = map.fromContainerPixelToLatLng(point_median["point"]);

// Only create the marker if we need to
            if ( marker_dragging ) {
              marker_dragging["marker"].setLatLng(latlng_median);
              marker_dragging["i"] = point_median["i"];
            }
// Marker doesn't exist. Let's initialize it
            else {

              var gicon = new GIcon({
                image:      "css/images/route-control-point.png",
                iconSize:   new GSize(16,16),
                iconAnchor: new GPoint(8,8)
              });
              var marker = new GMarker( 
                latlng_median, 
                { icon: gicon, draggable: true } 
              );

// Add the tie point to the route
              map.addOverlay(marker);
              marker_dragging = {
                marker: marker,
                i: point_median["i"]
              };

// Setup the events that will allow us to drag the new node point
// from one place to another. How exciting! :)
              GEvent.addListener(marker, "dragstart", function() {
                state_dragging = 1;
              });
              GEvent.addListener(marker, "dragend", function() {
                state_dragging = null;
              });
            }

            return 1;
          }
        }

// Remove previously laid marker if we don't have any edges
// that are near the location
        if ( marker_dragging ) {
            map.removeOverlay(marker_dragging["marker"]);
            marker_dragging = null;
        }

// Okay, no matches or anything. We'll return out
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

function route_locate_edge ( map, route_data, click_loc ) {
// --------------------------------------------------
// Given a route and X, Y coordinates, this
// function will attempt to place the X,Y coordinates
// onto the edge using bounding boxes and then distance 
// calculations
//

    var route_trace          = route_data["route_trace"];
    var route_trace_vertices = route_trace.getVertexCount();
    var point                = map.fromLatLngToContainerPixel(click_loc);

    var point_prev           = map.fromLatLngToContainerPixel(route_trace.getVertex(0));
    for ( var i=1; i < route_trace_vertices; i++ ) {
        var point_cur = map.fromLatLngToContainerPixel(route_trace.getVertex(i));
        var point_median = edge_click_within( point_prev, point_cur, point, 10 );
        if ( point_median ) {
            return {
              "point": point_median,
              "i": i
            };
        }
        point_prev = point_cur;
    }

    return;
}

function edge_click_within ( start_pt, end_pt, click_pt, r ) {
// --------------------------------------------------
// Given two vertexes and a click point, this function 
// will return a true value if the click is found to be 
// within the allowed ranges of the edge. Note that
// all the points should be of GPoint using the same axis
//

// A quick check to see if we're in the soft bounds. THis creates
// a bounding box for the edge so we can quickly see if the clickpt
// is within range of this edge
    if ( end_pt.y > start_pt.y ) {
        if ( end_pt.y   + r < click_pt.y ) return;
        if ( start_pt.y - r > click_pt.y ) return;
    }
    else {
        if ( start_pt.y + r < click_pt.y ) return;
        if ( end_pt.y   - r > click_pt.y ) return;
    }
    if ( end_pt.x > start_pt.x ) {
        if ( end_pt.x   + r < click_pt.x ) return;
        if ( start_pt.x - r > click_pt.x ) return;
    }
    else {
        if ( start_pt.x + r < click_pt.x ) return;
        if ( end_pt.x   - r > click_pt.x ) return;
    }

// So the point is within range of this edge. Let's
// run the stricter calculations through and if it
// still matches, provide the coordinates of the
// best intercept point on the edge
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


function debug_logcl ( msg ) {
// --------------------------------------------------
      $('#debug').val( msg + "\n" );
}


