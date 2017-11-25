'use babel';

import {PsqlQueryParser} from '../lib/psql-query-parser';

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
$$val1 
val2 ' $ 
val3 $$ 
FROM now();
`,

];

let correct_test_queries_counts = [
  [1, 2], [1, 1], [1, 1], [1, 3], [2, 3], [1, 2], [1, 1], [1, 1], [1, 1]
];

//6

let dump1 = function (sql) {
  console.log(sql);
  console.log('--');
  let qp = new PsqlQueryParser();
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
      for (let qc of qcs) {
        console.log("#c:  ", qc);
      }
    }
    console.log("==========================================================================");
  }
}


//let qp = new PsqlQueryParser();

describe('PsqlQueryParser', () => {

  it('test1', () => {
    dump1(test_sqls[6]);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  });
  //
  it('test2', () => {

    let i = 0;
    for (let sql of test_sqls) {
      let qp = new PsqlQueryParser();
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

    let i = 0;
    for (let sql of test_sqls) {
      let qp = new PsqlQueryParser();
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


});
