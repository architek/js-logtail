/* Copyright (c) 2012: Daniel Richman. License: GNU GPL 3 */
/* Additional features: Priyesh Patel                     */
/* Additional features: Laurent Kislaire                  */

(function () {

var dataelem = "#data";
var revtoggle= "#rev";
var pausetoggle = "#pause";
var searchbtn = "#search";

var url = "log";
var fix_rn = true;
var load = 30 * 1024; /* 30KB */
var poll = 1000; /* 1s */

var kill = false;
var loading = false;
var pause = false;
var reverse = true;
var log_data = "";
var log_file_size = 0;
var timeout;

/* :- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt */
function parseInt2(value) {
    if(!(/^[0-9]+$/.test(value))) throw "Invalid integer " + value;
    var v = Number(value);
    if (isNaN(v))                 throw "Invalid integer " + value;
    return v;
}

function get_log() {
    if (kill | loading) return;
    loading = true;

    var range;
    var first_load;
    var must_get_206;
    if (log_file_size === 0) {
        /* Get the last 'load' bytes */
        range = "-" + load.toString();
        first_load = true;
        must_get_206 = false;
    } else {
        /* Get the (log_file_size - 1)th byte, onwards. */
        range = (log_file_size - 1).toString() + "-";
        first_load = false;
        must_get_206 = log_file_size > 1;
    }

    /* The "log_file_size - 1" deliberately reloads the last byte, which we already
     * have. This is to prevent a 416 "Range unsatisfiable" error: a response
     * of length 1 tells us that the file hasn't changed yet. A 416 shows that
     * the file has been trucnated */

    $.ajax(url, {
        dataType: "text",
        cache: false,
        headers: {Range: "bytes=" + range},
        success: function (data, s, xhr) {
            loading = false;

            var content_size;

            if (xhr.status === 206) {
                var c_r = xhr.getResponseHeader("Content-Range");
                if (!c_r)
                    throw "Server did not respond with a Content-Range";

                log_file_size = parseInt2(c_r.split("/")[1]);
                content_size = parseInt2(xhr.getResponseHeader("Content-Length"));
            } else if (xhr.status === 200) {
                if (must_get_206)
                    throw "Expected 206 Partial Content";

                content_size = log_file_size =
                        parseInt2(xhr.getResponseHeader("Content-Length"));
            } else {
                throw "Unexpected status " + xhr.status;
            }

            if (first_load && data.length > load)
                throw "Server's response was too long";

            var added = false;

            if (first_load) {
                /* Clip leading part-line if not the whole file */
                if (content_size < log_file_size) {
                    var start = data.indexOf("\n");
                    log_data = data.substring(start + 1);
                } else {
                    log_data = data;
                }

                added = true;
            } else {
                /* Drop the first byte (see above) */
                log_data += data.substring(1);

                if (log_data.length > load) {
                    var start = log_data.indexOf("\n", log_data.length - load);
                    log_data = log_data.substring(start + 1);
                }

                if (data.length > 1)
                    added = true;
            }

            if (added)
                show_log(added);
            timeout = setTimeout(get_log, poll);
        },
        error: function (xhr, s, t) {
            loading = false;

            if (xhr.status === 416 || xhr.status == 404) {
                /* 416: Requested range not satisfiable: log was truncated. */
                /* 404: Retry soon, I guess */

                log_file_size = 0;
                log_data = "";
                show_log();

                timeout = setTimeout(get_log, poll);
            } else {
                throw "Unknown AJAX Error (status " + xhr.status + ")";
            }
        }
    });
}

function scroll(where) {
    /*var scrollelems = ["html", "body"];*/
    var scrollelems = ["html"];
    for (var i = 0; i < scrollelems.length; i++) {
        var s = $(scrollelems[i]);
        if (where === -1)
            s.scrollTop(s.height());
        else
            s.scrollTop(where);
    }
}

function show_log() {

    var t = log_data;

    if (reverse) {
        var t_a = t.split(/\n/g);
        t_a.reverse();
        if (t_a[0] == "")
            t_a.shift();
        t = t_a.join("\n");
    }

    if (fix_rn)
        t = t.replace(/\n/g, "\r\n");

    var p = $(input).val();
    if ( p !== "") {
        t = t + "\r\n";
        var re = new RegExp("^.*" + p +".*$\r\n","gm");
        t = t.replace(re,"");
    }

    $(dataelem).text(t);
    if (!reverse)
        scroll(-1);
}

function set_rev() {
    $(revtoggle).text(reverse ? "Chrono" : "Reversed" );
    if (reverse) {
        $("#header").insertBefore("#data");
        scroll(0);
    } else {
        $("#data").insertBefore("#header");
    }
}

function set_pause() {
    $(pausetoggle).text(pause ? "Unpause" : "Pause");
}

function error(what) {
    kill = true;

    $(dataelem).text("An error occured :-(.\r\n" +
                     "Reloading may help; no promises.\r\n" +
                     what);
    scroll(0);

    return false;
}

function getQueryParams(qs) {
    qs = qs.split('+').join(' ');

    var params = {},
        tokens,
        re = /[?&]?([^=]+)=([^&]*)/g;

    while (tokens = re.exec(qs)) {
        params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    }

    return params;
}

$(document).ready(function () {
    window.onerror = error;

    var searchinput = "#input";

    var query = getQueryParams(document.location.search);
    url  = query.url;
    document.title = url.replace( /^(?:.*\/)?(.*)$/ , '$1');
    var hash = query.load;
    if (hash > 0)
        load=1024*hash;

    /* Add search btn */
    $(searchbtn).click(function (e) {
        show_log();
        e.preventDefault();
    });

    $(searchinput).keypress(function (e) {
        if (e.which == 13) {
            show_log();
            return false;
        }
    });

    /* Add reverse toggle */
    $(revtoggle).click(function (e) {
        reverse= !reverse;
        set_rev();
        show_log();
        e.preventDefault();
    });

    /* Add pause toggle */
    $(pausetoggle).click(function (e) {
        pause = !pause;
        set_pause();
        if (pause) {
            clearTimeout(timeout);
        } else {
            show_log();
            timeout = setTimeout(get_log, poll);
        }
        e.preventDefault();
    });

    set_rev();
    set_pause();
    $(search).text(" Filter");
    get_log();
});

})();
