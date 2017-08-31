# javascript logtailer

Ludicrously simple remote unix 'tail -f' like log viewer.

This uses an ajax request, and the HTTP Range: header to request only the last
KB of a log file. It then polls for data appended to that file, and only
ever retrieves new data (no refreshing the whole file, or even the last KB).
Handles file truncation too.

No server side code is required - it's all just static files

Should work with all modern web servers and browsers supporting Range (tested nginx with Firefox) 

Usage:

http://server/js-logtail?url=/log/syslog&load=300

will show the last 300KB of syslog

The filter can be used to filter out lines containing a pattern
 * *localhost* will filter out lines containing *localhost*
 * *(localhost|ACCEPT)* will filter out lines containing either *localhost* or *ACCEPT*

On the server side, you'll need to:
 * alias /log to /var/log
 * give read access to the user which runs the webserver
 * make sure logrotate config doesn't have any *create* option to keep attributes 
   for the new file as they were for the original log file

Example (webserver nginx)

    location /js-logtail {
        alias /var/www/js-logtail/;
        index index.html;
    }
    location /log/ {
       alias /var/log/;
       access_log off;
    }

    setfacl -m u:www-data:r kern.log


License is GNU GPL 3; see http://www.gnu.org/licenses/

jQuery is included in this repository (jquery.min.js);
see http://jquery.org/license
