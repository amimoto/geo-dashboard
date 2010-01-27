#!/usr/bin/perl

use strict;
use lib 'lib';
use lib '../gps-mtk/lib';
use threads;
use threads::shared;
use JSON;
use GPS::MTK::Constants qw/:commands/;
use GPS::MTK;
use Time::HiRes qw/ time /;
use HTTP::Cookies;
use WWW::Mechanize;
use vars qw/ $CFG $SHARED /;
$|++;

$CFG = {
    paths     => {
        comm => [ '/dev/ttyACM0', '/dev/rfcomm3' ],
    },
    webserver => {},
    database  => { db_fpath => 'dashboard.sqlite' },
    api_url   => 'http://test.bako.ca/api/569402bca20967cb54436731a64c42d9',
};

main();

sub main {
# --------------------------------------------------
# Just here to give a quick block view of the overalll
# structure of the code. A sequence of inits and
# the main dispatch thread sits on the update loop
#
    init();
    dispatch();
}

sub init {
# --------------------------------------------------
    $SHARED = {};
    share($SHARED);
    my $init_shared = {
        device_state => '',
    };
    @$SHARED{keys %$init_shared} = values %$init_shared;
};

sub gps {
# --------------------------------------------------
# This connects to the GPS and allows us to keep sending
# updates to the client app
#
    $SIG{KILL} = sub { threads->exit() };
    print "Connecting...\n";

# Figure out which serial port we're trying to use...
    my $comm_port_fpath;
    for ( @{$CFG->{paths}{comm}} ) {
        next unless -e $_;
        $comm_port_fpath = $_;
    }
    $comm_port_fpath or die "No comm ports found!";

# Then let's create the object that will handle our data
    my $device = GPS::MTK->connect( 
                        comm_port_fpath => $comm_port_fpath,
                        probe_skip      => 1,
                    );

# Hook into only the GPGGA
    my $handler = $device->handler_obj;
    $handler->event_hook(
        GPGGA => sub {
        # --------------------------------------------------
            my ( $mydata,$verb,$args,$self,$hook_key) = @_;
            my $state    = $self->state;
            my %key_trans = (
                "unixtime" => "gps_time",
                "lat"     => "gps_lat",
                "lon"     => "gps_lon",
                "alt"     => "gps_alt",
                "speed"   => "gps_speed",
                "hdop"    => "gps_hdop",
                "vdop"    => "gps_vdop",
                "heading" => "gps_heading",
                "fix"     => "gps_fix",
            );
            while ( my ( $from, $to ) = each %key_trans ) {
                $SHARED->{$to} = $state->{$from};
            }
            $SHARED->{gps_data} = JSON::to_json($state);
        }
    );

# Now, all we need to do is loop on the gps device's
# IO handler. Sending the data to the main server will be 
# handled by the event function
    print "Connected! <$device>\n";

    while (1) {
        $device->blocking(1);
        $device->loop;
    }

}

sub dispatch {
# --------------------------------------------------
# We try and update the server as frequently as we can.
# sometimes we may end up in some sort of latancy
# trap so we won't be able to push data right away.
# That's okay... we can wait... I think...
#

# Start the GPS connection
    my $gps_thread = threads->create('gps');

# Get a session key
    my $api_conn   = WWW::Mechanize->new;
    my $cookie_jar = HTTP::Cookies->new;
    $api_conn->cookie_jar($cookie_jar);
    $api_conn->get($CFG->{api_url}."/actions/login.json");

# Okay, the api_conn now has a cookie. We can continue on
    while (1) {
        use Data::Dumper; warn Dumper $SHARED;
        $api_conn->post(
            $CFG->{api_url}."/actions/gps.json",
            {
                %$SHARED,
                a => "add",
            },
        );
        sleep(1);
    }
}

sub json_response {
# --------------------------------------------------
# Just craft the HTTP::Response object required 
# for responses
#
    my ( $data ) = @_;

    my $json_buf = to_json($data);
    my $r = HTTP::Response->new(200);
    $r->header('Content-type','application/json');
    $r->content($json_buf."\n");
    warn $json_buf."\n";
    return $r;
}


__END__

{
  'mag_var_dir' => '',
  'date' => '171209',
  'status' => 'A',
  'lat' => '49.273215',
  'heading' => '151.28',
  'age' => '-16.8',
  'hdop' => '1.7',
  'sat_vhdop' => '',
  'speed' => '1.00',
  'sat_hdop' => '04',
  'station' => 'M',
  'alt' => '9.6',
  'satellites' => [
                    {
                      'sat_snr' => '16',
                      'sat_prn' => '12',
                      'sat_elevation' => '82',
                      'sat_azimuth' => '231'
                    },
                    {
                      'sat_snr' => '',
                      'sat_prn' => '02',
                      'sat_elevation' => '71',
                      'sat_azimuth' => '134'
                    },
                    {
                      'sat_snr' => '23',
                      'sat_prn' => '30',
                      'sat_elevation' => '50',
                      'sat_azimuth' => '299'
                    },
                    {
                      'sat_snr' => '24',
                      'sat_prn' => '04',
                      'sat_elevation' => '45',
                      'sat_azimuth' => '060'
                    },
                    {
                      'sat_snr' => '',
                      'sat_prn' => '29',
                      'sat_elevation' => '21',
                      'sat_azimuth' => '265'
                    },
                    {
                      'sat_snr' => '19',
                      'sat_prn' => '09',
                      'sat_elevation' => '17',
                      'sat_azimuth' => '201'
                    },
                    {
                      'sat_snr' => '',
                      'sat_prn' => '27',
                      'sat_elevation' => '14',
                      'sat_azimuth' => '199'
                    },
                    {
                      'sat_snr' => '14',
                      'sat_prn' => '10',
                      'sat_elevation' => '12',
                      'sat_azimuth' => '141'
                    },
                    {
                      'sat_snr' => '18',
                      'sat_prn' => '05',
                      'sat_elevation' => '06',
                      'sat_azimuth' => '153'
                    },
                    {
                      'sat_snr' => '',
                      'sat_prn' => '31',
                      'sat_elevation' => '06',
                      'sat_azimuth' => '333'
                    },
                    {
                      'sat_snr' => undef,
                      'sat_prn' => '17',
                      'sat_elevation' => '05',
                      'sat_azimuth' => '080'
                    }
                  ],
  'fix' => '1',
  'utc' => '175712.000',
  'sat_mode' => 'A',
  'unixtime' => 1261072631,
  'sat_fix' => '2',
  'sat_dop' => '09',
  'sat_prn_number' => '30',
  'mag_var' => '',
  'lon' => '-123.099872',
  'sats' => '03',
  'units' => 'M'
};

