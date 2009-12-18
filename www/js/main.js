var gps_marker = null;

var tics_last  = 0;
var tics_start = new Date();

var tics_status_poll = 1000;
var poll_pause       = 0;

/***************************************************
 * INITIALIZATION
 ***************************************************/
$(function(){
// Setup the GPS position poll
    $().everyTime( tics_status_poll, gps_status_poll );
});

/***************************************************
 * PERIODIC EVENTS
 ***************************************************/
function gps_status_poll () {
// --------------------------------------------------
// Request an update from the server every tics_status_poll 
// milliseconds so that we can move the user from one place 
// to another or update the POV as required :)
//
//
    var data = {};
    var now  = new Date();

// Should only be used while the streetview is updating to a new location
    if ( poll_pause ) {
        return;
    };

// We don't want to double up requests so we will wait 1 second before
// issuing a new request if it hung
    if ( tics_last && ( now.getTime() - 1000 < tics_last.getTime() ) ) {
        return;
    }

// Record that we're starting a new request.
    tics_last = now;

    jQuery.getJSON( 
        '/gps_state.json', 
        data, 
        function ( data ) {
        // --------------------------------------------------
        // Receive the current status of the HMD and distance
        // travelled on the bike.
        //
            var new_position = new GLatLng( data.lat, data.lon );
            if ( !gps_marker ) {
                gps_marker = new GMarker(new_position);
                map.addOverlay(gps_marker);
            }
            else {
                gps_marker.setLatLng(new_position);
            }
            return;
        }
    );
}

