#!/usr/bin/perl

use strict;
use CGI;
use DBI;
use JSON;
use vars qw/ $IN /;

main();

sub init {
# --------------------------------------------------
    $IN = CGI->new;
}

sub main {
# --------------------------------------------------
    init();
    my $action = $IN->params('a');
}

sub action_login {
# --------------------------------------------------
}

