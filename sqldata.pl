#!/usr/bin/perl

use strict;
use DBI;
use Data::Dumper;

my $db_fpath = shift @ARGV;
die "cannot find db" unless -f $db_fpath;
my $dbi = DBI->connect("dbi:SQLite:dbname=$db_fpath",undef,undef) or die $DBI::errstr;

# Get a list of all the tables
my $tb_query = $dbi->prepare('select name from sqlite_master where type = "table"') or die $DBI::errstr;
   $tb_query->execute or die $DBI::errstr;
my @tb_list  = map {$_->[0]} @{$tb_query->fetchall_arrayref()} or die $DBI::errstr;

# Now dump out all the data
for my $tb_name ( @tb_list ) {
    next if $tb_name eq 'sqlite_sequence';
    print "\n--------------------------------\nTABLE: $tb_name\n\n";
    my $col_query = $dbi->prepare("pragma table_info($tb_name)") or die $DBI::errstr;
       $col_query->execute();
    while ( my $ci = $col_query->fetchrow_hashref ) {
        printf qq`    %-20s => { %s },\n`,
                    $ci->{name},
                    join(", ",(
                        qq`type => "$ci->{type}"`,
                        ( $ci->{pk} ? qq`primary_key => 1` : () ),
                        ( $ci->{notnull} ? qq`notnull => 1` : () ),
                    ))
                    ;
    }
}


