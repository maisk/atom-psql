# atom-psql
Use PostgreSQL psql client from within Atom


![alt text](https://raw.githubusercontent.com/maisk/atom-psql/master/doc/atom-psql.png "screenshot")



Basic Features:
 * Integrated psql terminal
 * Transfer commands from editor to psql  
 * transfer commands from psq to editor with \e
 * Psql error rendering with atom notifications
 * \gset variables view
 * Render query results in html view
 * Render query results in text view
 * Open query results in editor
 * Editor autocomplete for table names 
 * Editor autocomplete for gset variables
 * Toolbar 
 * Specific psqlrc for atom-psql  use: ~/.atom-psqlrc
 * Autoclose of query result views
 * Capture psql ouput to terminal :atom_capture_start atom_capture_stop
 * Create connection using environment variables or gui dialog
 * List Databases integrated in login dialog 
 * Transaction status integrated into gui
 * send \d [text] to psql when right click on selected text (in editor)
 * explore tables and views (schema and rows)
 * extra right click context options in some places 
 

currently run only in Linux and Mac.

In order to start use: F9 or menu: "Packages -> atom-psql -> new Connection"  
 

for demosntration of \gset you can try:
<pre>
SELECT 1 as v1, now() \gset r_
SELECT :r_v1 + 1 as sum1 \gset
SELECT :sum1 + 1 as sum2;
</pre>

