#!/usr/bin/perl

use strict;
use lib 'lib';
use lib '../gps-mtk/lib';
use threads;
use threads::shared;
use JSON;
use HTTP::Daemon;
use HTTP::Status;
use GPS::MTK::Constants qw/:commands/;
use GPS::MTK;
use Time::HiRes qw/ time /;
use constant{
        PI => 3.14156
    };
use vars qw/ $CFG $SHARED /;
$|++;

$CFG = {
    paths     => {},
    webserver => {},
    database  => { db_fpath => 'dashboard.sqlite' },
    api_url   => 'http://test.bako.ca/api/569402bca20967cb54436731a64c42d9/',
};

main();

sub main {
# --------------------------------------------------
# Just here to give a quick block view of the overalll
# structure of the code. A sequence of inits and
# the main webserver sits on the update loop
#
    init();
    webserver();
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
    for ( '/dev/rfcomm3' ) {
        next unless -e $_;
        $comm_port_fpath = $_;
    }
    $comm_port_fpath or die "No comm ports found!";

# Then let's create the object that will handle our data
    my $device = GPS::MTK->connect( 
                        comm_port_fpath => $comm_port_fpath,
                        probe_skip      => 1,
                    );
    print "Connected!\n";

    while (1) {
        $device->blocking(1);
        if ( $device->loop ) {
            my $state = $device->gps_state;
            $SHARED->{device_state} = JSON::to_json($state);
        }
    }

}

sub webserver {
# --------------------------------------------------
#    my $d = HTTP::Daemon->new(LocalAddr => '192.168.1.100') || die;
    my $d = HTTP::Daemon->new(LocalAddr => 'localhost') || die;
    my $gps_thread;
    print "Please contact me at: ", $d->url, "gps_state.json\n";
    while (my $c = $d->accept) {
        RUN_REQUESTS: while (my $r = $c->get_request) {
            HANDLE: {

# Okay, we have an incoming request. What do we want to do with the
# request?
                my $fpath = $r->url->path || '/'.$CFG->{webserver}{index};

                print "Request: $fpath\n";

# Particular paths bring about particular functions... this one 
# will report back the current orientation of the HMD so that the user
# can "look around" the space.
                if ( $fpath eq '/gps_state.json' ) {

print "Sending state\n";
                    my $r = HTTP::Response->new(200);
                    $r->header('Content-type','application/json');
                    $r->content($SHARED->{device_state}||'{}');
print $SHARED->{device_state} . "\n";
                    $c->send_response($r);
                    $c->close;

# Create the thread that keeps track of how fast the 
# bike tire is spinning
                    $gps_thread ||= threads->create('gps');

                    next RUN_REQUESTS;
                }

                elsif ( $fpath eq '/gps_restart.json' ) {
                    $c->send_response(json_response({}));
                    $c->close;
                    $gps_thread and $gps_thread->kill('SIGKILL')->detach;
                    $gps_thread = threads->create('gps');
                    next RUN_REQUESTS;
                }
            };

            $c->send_error(RC_FORBIDDEN)
        }
        $c->close;
        undef($c);
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

