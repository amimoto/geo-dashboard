#!/usr/bin/perl

use strict;
use CGI;
use DBI;
use Digest::MD5;
use JSON;
use Data::Dumper;
use vars qw/ $IN $DB $CFG /;

main('/home/aki/projects/geo-dashboard/var/conf/dashboard.conf');

sub init {
# --------------------------------------------------
# This will prepare the requisite connection variables
# for the system.
#
    my $conf_fpath = shift;
    die "Could not find configuration file path @ $conf_fpath" unless -f $conf_fpath;
    $CFG = do $conf_fpath;
    $IN = CGI->new;
    $DB = DBI->connect(@{$CFG->{db}{dsn}});
}

sub main {
# --------------------------------------------------
# Handle the main initialization calls and dispatching
# of the requested functions
#
    init(@_);
    my $action = $IN->param('a');
    my $func = "action_$action";
    my $args = $IN->Vars;
    print $IN->header;
    print __PACKAGE__->can( $func ) ? __PACKAGE__->$func($args)
                                    : response_error('Unknown action requested');
}

##################################################
# Actions
##################################################

sub action_login {
# --------------------------------------------------
# Attempt to log the user into personal data
#
    my ( $pkg, $args ) = @_;

# Check if requisite parameters have been defined
    my ($user,$pass) = @$args{qw( user pass )};
    unless ( $user and $pass ) {
        return response_error('Invalid Login');
    }

# Let's lookup the user in the database
    my $user_query = q`select * from geo_users where usr_user = ?`;
    my $user_rec = $DB->selectrow_hashref( $user_query, {}, $user ) 
        or return response_error('Invalid Login');
    if ( $user_rec->{usr_pass} ne password_hash( $pass, $user_rec->{usr_pass} ) ) {
        return response_error('Invalid Login');
    }

# Okay the user has been validated. Let's create a session for them
    my $ses_key = session_create( $user_rec );

    return response_success({
        session_key => $ses_key
    });
}

sub action_logout {
# --------------------------------------------------
# Nuke the user's session
#
    my ( $pkg, $args ) = @_;

# Check if requisite parameters have been defined
    my $ses_key = $self->{s} or return response_error('Require Session Key');

# And remove it
    session_drop( $ses_key );

    return response_success();
}

sub action_track_store {
# --------------------------------------------------
# Stores a single track into the persistant store
#
    my ( $pkg, $args ) = @_;
}

##################################################
# Utility
##################################################

sub response_error {
# --------------------------------------------------
# Convert a text message into a serialized json record 
# that can be streamed back to the calling application
#
    my ( $message ) = @_;
    my $resp = {
        error => $message
    };
    return to_json($resp);
}

sub response_success {
# --------------------------------------------------
# Convert a response object into soething that can be
# used by the calling application. Yay JSON!
#
    my ( $data ) = @_;
    $data ||= {};
    my $resp = {
        success => 1,
        data    => $data
    };
    return to_json($resp);
}

##################################################
# Session related
##################################################

sub session_create {
# --------------------------------------------------
# Creates a session in the session database
# for the user
#
    my ( $user, $data ) = @_;

# Create a random key
    my $ses_key;
    my $ses_count = 'select count(*) from geo_sessions where ses_key = ?';
    do {
        $ses_key = Digest::MD5::md5_hex( time * $$ * rand() );
    } while (($DB->selectrow_arrayref($ses_count))->[0]);

# Serialize the session data
    $data ||= {};
    my $data_json = to_json($data);

# Create the session
    my $ses_create = 'insert into geo_sessions (usr_id_fk,ses_key,ses_data) values(?,?,?)';
    $DB->selectrow_hashref($ses_create,{},$user->{usr_id},$ses_key,$data_json);

# All done, assign new key
    return $ses_key;
}

sub session_drop {
# --------------------------------------------------
# Removes a session from the database (effectively,
# logs the user out)
#
    my ( $ses_key ) = @_;
    return unless $ses_key;
    my $ses_delete = 'delete from geo_sessions where ses_key = ? limit 1';
    $DB->selectrow_arrayref($ses_delete);
    return 1;
}

sub password_hash {
# --------------------------------------------------
# This will hash a password using an MD5 digest. It
# will also include a 4 byte salt at the begining to
# prevent simple lookup table attacks
#
    my ( $pass, $salt ) = @_;

# Only use 4 chars from the salt
    if ( $salt ) {
        $salt = substr $salt, 0, 4;
    }
# If we don't have a salt, create one by stringing
# 4 random characters together
    else {
        my $chars = ['a'..'z','A'..'Z',0..9];
        for (1..4) {
            $salt .= $chars->[int(rand(0+@$chars))];
        }
    }

# Now we can run the crypt through
    my $pass_digest = $salt . Digest::MD5::md5_hex($salt . $pass);

    return $pass_digest;
}
