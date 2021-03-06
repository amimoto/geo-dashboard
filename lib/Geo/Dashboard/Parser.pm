# ==================================================================
#
#   Author: Aki Mimoto
#   $Id$
#
# ==================================================================
#
# Description: Allowed embedded perl
#

package Geo::Dashboard::Parser;
# ==================================================================

use strict;
use Moose;
our ( $CACHE, $TEMPLATE_OUTPUT, $SELF, $ARGS, $OPTS );
has root_path => ( is => "rw", isa => "Str", default => "" );
has cache_path => ( is => "rw", isa => "Str", default => "" );
has cache => ( is => "rw", isa => "Str", default => "0" );
has compile_header => ( is => "rw", isa => "Str", default => q`#line 1:eval
                            sub {
                                local $TEMPLATE_OUTPUT = '';
                            ` );

has compile_footer => ( is => "rw", isa => "Str", default => q`
                                return $TEMPLATE_OUTPUT;
                            }
                        `);


$CACHE = {};

sub parse {
# --------------------------------------------------
    my ( $self, $cache_name, $args, $opts ) = @_;

# self must be an object ref, not a package name
    ref $self or $self = $self->new($opts);

# Compile the file if required
    my $compiled_fn = $self->make( $cache_name, $args, $opts ) or return;

    my $buf;
    eval { 
        local $SELF = $self;
        local $ARGS = $args;
        local $OPTS = $opts;
        $buf = $compiled_fn->();
    };
    $@ and die $@;

    return $buf;
}

sub string_parse {
# --------------------------------------------------
# Takes a single string and parses that... rather than
# a file. This is mostly a convenience function
#
    my ( $self, $string, $args, $opts ) = @_;
    $opts||={};
    $opts->{string} = $string;
    defined $opts->{cache} or $opts->{cache} = 0;
    return $self->parse('', $args, $opts);
}

# Helper functions
sub out {$TEMPLATE_OUTPUT.=join "",map{ref$_?$$_:$_}@_};
sub include {$TEMPLATE_OUTPUT.=$SELF->parse(shift,$ARGS,$OPTS)};

sub make {
# --------------------------------------------------
# Takes a canonical path and compiles the file
#
    my ( $self, $cache_name, $args, $opts ) = @_;

# Where is the data-source?
    my ( $data, $template_func );

# it's coming as a string!
    if ( $opts->{string} ) {
        return $CACHE->{$cache_name}[0] if $self->{cache} and $CACHE->{$cache_name};
        $data = $opts->{string};
    }

# Nope, it's a path to a file!
    else {

        $cache_name = $self->fpath( $cache_name, $opts->{root_path}, $args );
        return $CACHE->{$cache_name}[0] if $self->{cache} and $CACHE->{$cache_name};
        return unless -f $cache_name;
        open my $fh, "<$cache_name" or return;
        local $/;
        $data = <$fh>;
    }

# Make sure we have something to parse!
    $data or return;

# Ok, now we have the data, let's see if we can compile it. Slightly dirty, we 
# just split into chunks that use the <? ... ?> args. Stuff outside the <?...?> are
# considered raw text and are left-as-is
    my @compiled;
    my @elements   = split /(<\?.*?\?>)/s, $data;
    my $strip_next = 0;
    my $line = 1;

    for my $e ( @elements ) {
        my @e_lines = ( $e =~ /(\n\r?)/g );
        my $e_lines = 0+@e_lines;

# if this is commenced and terminated by a tag header
# let's assume it's embperl
        if ( $e =~ /^<\?/ and $e =~ /\?>$/  ) {
            $e =~ s/^<\?//;
            $e =~ s/\?>$//;

# Handle the stripping of text
            if ( $e =~ s/^~// ) { # pre strip
                $compiled[-1][0] =~ s/\s*$//s;
            }
            if ( $e =~ s/~$// ) { # post strip
                $strip_next = 1;
            }

# Ignore any comments
            next if $e =~ /^--/;

# Now, if it's embperl, are they using any special macros?

# use the "="s as a macro to out
            if ( $e =~ s/^=\s*// ) {
                push @compiled, [ \"out $e;", $line ];
            }

# We ignore <?! anything
            elsif ( $e =~ s/^!// ) {
                push @compiled, [ "<?$e?>", $line ];
            }

# Otherwise, it's just raw code, let's tosser 'er in
            else {
                push @compiled, [ \$e, $line];
            }
        }

# Otherwise, it's a literal
        else {
            if ( $strip_next ) {
                $e =~ s/^\s*//;
                $strip_next = 0;
            };
            push @compiled, [ $e, $line ];
        }

        $line += $e_lines;
    }

    my $compiled = '';
    for my $e ( @compiled ) {
        if ( ref $e->[0] ) {
            $compiled .= ${$e->[0]} . ";";
        }
        else {
            next if $e->[0] eq '';
            $compiled .= qq{out("} . quotemeta($e->[0]) . qq{");\n};
        }
    }

    my $compiled_str = $self->compile_header
                             . $compiled 
                             . $self->compile_footer;
    my $compiled_fn = eval $compiled_str;
    $@ and die "Could not commpile template because: $@";

    $self->{cache} and $cache_name and $CACHE->{$cache_name} = [ $compiled_fn, time ];

    return $compiled_fn;
}

sub fpath {
# --------------------------------------------------
# Provided with a root, this will track down
# the most appropriate template and return its template
# path
# $args here is never used but is available if a user
# wishes to subclass this module
#
    my ( $self, $fname, $root, $args ) = @_;

# We only allow "safe" names for templates
    $fname =~ /^([\w\s\-]+\.?\/?)+[\w+]$/ or return;

    defined $root or $root = $self->{root_path};

    my $fpath = $root ? "$root/$fname" : $fname;

    return $fpath;
}

1;

__END__

Allows templates of the form

<??>
