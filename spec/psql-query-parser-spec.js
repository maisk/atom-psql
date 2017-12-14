'use babel';

import {PsqlQueryParserLine} from '../lib/psql-query-parser-line';
//import {PsqlQueryParser} from '../lib/psql-query-parser';

let test_sqls = [
//0
  `
SELECT 'koko','lala','tes;
;t1',2 FROM NOW(); select 1;
`,
//1
  `
SELECT 'koko', $$tes;
t1$$,2 FROM
NOW();
`,
//2
  `
SELECT 'koko', $sep$tes;
t1$sep$,2 FROM
NOW();
`,
//3
  `begin; select 1; commit;`,
//4
  `begin; select 1 FROM "table1";
  commit;`,
//5
  `
 CREATE OR REPLACE FUNCTION test2(arg1 integer) RETURNS varchar AS $fn$
DECLARE
_rep varchar;
BEGIN
_rep :=0;
return _rep;
END
$fn$ LANGUAGE plpgsql; select 1 from now();
 `,
//6
  `
   SELECT t1.a,t2.a FROM s1.table1 t1
   JOIN s1.table2 t2 ON (t1.id = t2.id)
   WHERE  t1.c in ('a',$$b$$)
   ORDER BY t1.d
   LIMIT 1;
   `,
//7
  `
  select 
  '$$val1 
  val2  $ val3 $$' 
   FROM now();
  `,
//8
  `
select 
--sxolio ;
$$val1 
val2 ' $ 
val3 $$ 
FROM now();
`,
//9
`
  SELECT t1.a,t2.a FROM s1.table1 t1
  JOIN s1.table2 t2 ON (t1.id = t2.id)
  -- sxolio 1 ;
WHERE  t1.c in ('a',$$b$$)
/*
sxolio 2 ;
*/
ORDER BY t1.d
LIMIT 1;
`,
  //10
`
WITH regional_sales AS (
        SELECT region, SUM(amount) AS total_sales
        FROM orders
        GROUP BY region
     ), top_regions AS (
        SELECT region
        FROM regional_sales
        WHERE total_sales > (SELECT SUM(total_sales)/10 FROM regional_sales)
     )
     --soxlio
SELECT region,
       product,
       SUM(quantity) AS product_units,
       SUM(amount) AS product_sales
FROM orders
WHERE region IN (SELECT region FROM top_regions)
GROUP BY region, product;
`

];

let correct_test_queries_counts = [
  [1, 2], [1, 1], [1, 1], [1, 3], [2, 3], [1, 2], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1]
];



let dump1 = function (sql) {
  console.log(sql);
  console.log('--');
  let qp = new PsqlQueryParserLine();
  //qp.reset();
  qp.addText(sql);
  let queries = qp.getQueriesExtend();

  console.log('------------------------------------------------')
  let qc = 0;
  for (let q of queries) {
    qc += 1;
    console.log('>>>:', qc);
    console.log(q['q']);
    console.log('#-----------------------------------------------')
    if (q['clean']) {
      let qcs = q['clean'];
      let j = 0;
      for (let qc of qcs) {
        j+=1;
        console.log("#c" + j +":  ", qc);
      }
    }
    console.log("==========================================================================");
  }
}

// let dump2 = function (sql) {
//   console.log(sql);
//   console.log('--');
//   let qp = new PsqlQueryParser();
//   //qp.reset();
//   qp.addText(sql);
//   let queries = qp.getQueriesExtend();
//
//   console.log('------------------------------------------------')
//   let qc = 0;
//   for (let q of queries) {
//     qc += 1;
//     console.log('>>>:', qc);
//     console.log(q['q']);
//     console.log('#-----------------------------------------------')
//     if (q['clean']) {
//       let qcs = q['clean'];
//       let j = 0;
//       for (let qc of qcs) {
//         j+=1;
//         console.log("#c" + j +":  ", qc);
//       }
//     }
//     console.log("==========================================================================");
//   }
// }



describe('PsqlQueryParserLine', () => {



  it('test1', () => {
    dump1(test_sqls[6]);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  });
  //
  it('test2', () => {

    let i = 0;
    for (let sql of test_sqls) {
      let qp = new PsqlQueryParserLine();
      qp.addText(sql);
      let queries = qp.getQueriesExtend();
      let q = queries.length;
      let c = 0;
      for (let query of queries) {
        c += query['clean'].length;
      }

      let q_ok = correct_test_queries_counts[i][0];
      let c_ok = correct_test_queries_counts[i][1];
      console.log("#", i, 'CMD_COUNT', q, 'CLEAN_COUNT', c, 'oks:', q_ok, c_ok);
      expect(q).toBe(q_ok);
      expect(c).toBe(c_ok);
      i += 1;
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  });
  it('test3', () => {

    // 0 1 1 "SELECT ❎,❎,❎,2 FROM NOW()"
    // 0 1 2 "select 1"
    // -------------------------------------------------------------------------------
    // 1 1 1 "SELECT ❎, ❎,2 FROM NOW()"
    // -------------------------------------------------------------------------------
    // 2 1 1 "SELECT ❎, ❎,2 FROM NOW()"
    // -------------------------------------------------------------------------------
    // 3 1 1 "begin"
    // 3 1 2 "select 1"
    // 3 1 3 "commit"
    // -------------------------------------------------------------------------------
    // 4 1 1 "begin"
    // 4 1 2 "select 1 FROM "table1""
    // -------------------------------------------------------------------------------
    // 4 2 1 "commit"
    // -------------------------------------------------------------------------------
    // 5 1 1 "CREATE OR REPLACE FUNCTION test2(arg1 integer) RETURNS varchar AS ❎ LANGUAGE plpgsql"
    // 5 1 2 "select 1 from now()"
    // -------------------------------------------------------------------------------
    // 6 1 1 "SELECT t1.a,t2.a FROM s1.table1 t1 JOIN s1.table2 t2 ON (t1.id = t2.id) WHERE t1.c in (❎,❎) ORDER BY t1.d LIMIT 1"
    // -------------------------------------------------------------------------------
    // 7 1 1 "select ❎ FROM now()"
    // -------------------------------------------------------------------------------
    // 8 1 1 "select ❎ FROM now()"
    // -------------------------------------------------------------------------------

    let i = 0;
    for (let sql of test_sqls) {
      let qp = new PsqlQueryParserLine();
      qp.addText(sql);
      let queries = qp.getQueriesExtend();
      let q = queries.length;
      let ii = 0;
      for (let query of queries) {
        ii += 1;
        let iii = 0;
        for (let cs of query['clean']) {
          iii += 1;
          console.log(i, ii, iii, cs);
        }
        console.log('-------------------------------------------------------------------------------');
      }
      i += 1;
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  });


  it('test5', () => {
    let qp = new PsqlQueryParserLine();
    qp.addText('select * from now()');
    let queries = qp.getQueriesExtend();
    let ql = queries.length;
    expect(ql).toBe(1);
    if (ql == 1) {
      let q = queries[0];
      expect(q['q']).toBe('select * from now();');
      let clean = q['clean'];
      expect(clean.length).toBe(1);
      if (clean.length == 1) {
        expect(clean[0]).toBe('select * from now()');
      }
    }
  });

  it('test6', () => {
    let qp = new PsqlQueryParserLine();
    qp.addText(test_sqls[6]);
    let queries = qp.getQueriesExtend();
    let ql = queries.length;
    expect(ql).toBe(1);
    if (ql == 1) {
      let q = queries[0];
      console.log(q['q']);
      //expect(q['q']).toBe('select * from now();');
      let clean = q['clean'];
      expect(clean.length).toBe(1);
      if (clean.length == 1) {
        let okQ = 'SELECT t1.a,t2.a FROM s1.table1 t1 JOIN s1.table2 t2 ON (t1.id = t2.id) WHERE t1.c in (❎,❎) ORDER BY t1.d LIMIT 1';
        console.log(okQ);
        expect(clean[0]).toBe(okQ);
      }
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  });




  it('test10',()=>{
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    let SQL= test_sqls[9];
    dump1(SQL);
   });




});



// describe('PsqlQueryParser', () => {
//
//   it('testDEV', () => {
//     console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
//     console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
//     let SQL = `
// SELECT 'koko','lala','tes;
// ;t1',2 FROM NOW(); select 1;
// `;
//     dump2(SQL);
//   });
//
// });