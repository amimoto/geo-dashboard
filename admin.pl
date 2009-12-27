#!/usr/bin/perl

# Allows the administration of the various facets of the Geo::Dashboard code

use strict;
use lib 'lib';
use Getopt::Std;
use Geo::Dashboard;

@ARGV or do { HELP_MESSAGE(); exit; };
my $opts = {};
getopt('ha:p:s:lr:d:',$opts);
main($opts);

sub main {
# --------------------------------------------------
    my ( $opts ) = @_;

    Geo::Dashboard->init;

# Add a new user record to the database
    if ( $opts->{a} ) {
        require Geo::Dashboard::User;
        Geo::Dashboard::User->user_add({
            usr_login  => $opts->{a},
            usr_pass   => $opts->{p},
            usr_status => $opts->{s},
        });
    }


# Delete user record from the database
    elsif ( $opts->{d} ) {
        require Geo::Dashboard::User;
        Geo::Dashboard::User->user_delete({
            usr_login  => $opts->{d},
        });
    }

# List users in the database
    elsif ( exists $opts->{l} ) {
        require Geo::Dashboard::User;
        my $list = Geo::Dashboard::User->user_list();
        for ( @$list ) {
            print "$_->{usr_login}\n";
        }
    }

# Create the tables
    elsif ( $opts->{i} ) {
        require Geo::Dashboard::DB;
        Geo::Dashboard::DB::db_init();
    }
}

sub HELP_MESSAGE {
# --------------------------------------------------
    print qq`
NAME
    $0 - Control the data and settings for Geo::Dashboard

SYNOPSIS
    $0 [options] 

OPTIONS

    -h  This help documentation

    -i  Create the tables required by the system

    -a "username"       Add a new user to the database
        -p "password"   New Password for user
        -s "status"     New status for the user

    -l  List users

    -d "username"       Delete the user from the database

`
}
