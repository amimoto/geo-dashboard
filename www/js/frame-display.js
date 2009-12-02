/*
 * Initialization
 */

var map;
var geocoder;
var directions;

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
  var summary = directions.getSummaryHtml();

// Draw the route
  var route_id = route_count;
  route_lookup_rec = {
    route_id: route_id,
    route_info: route_info,
    route_trace: route_trace,
    route_copyright: directions.getCopyrightsHtml(),
    summary: summary,
    query: directions_query
  };
  route_list.push(route_lookup_rec);

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
        $('#debug').val(latlon);
        return;
    }
  );

// We capture the click event for... um... not sure. We'll need
// to support drag instead!
  route_lookup_rec["listen_click"] = GEvent.addListener( 
    route_trace, 
    'click',     
    function(latlon) {} 
  );
  route_count++;

// Send the route to the route store for our use

  route_trace.enableEditing();

// kind of like line drawing
//  route_trace.enableDrawing();

  map.addOverlay(route_trace);

  return;
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

