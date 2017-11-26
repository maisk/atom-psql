create view v_data as
  select * from ( values
    ('v1','h2','foo', '2015-04-01'::date),
    ('v2','h1','bar', '2015-01-02'),
    ('v1','h0','baz', '2015-07-12'),
    ('v0','h4','qux', '2015-07-15')
                ) as l(v,h,c,d);

SELECT *
FROM non_existent_table;
select v,h,c from v_data \crosstabview
BEGIN;
BEGIN;