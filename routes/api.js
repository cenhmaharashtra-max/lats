const router = require('express').Router();
const pool   = require('../db/pool');

const requireAuth  = (req,res,next) => req.session.user ? next() : res.status(401).json({error:'Not logged in'});
const requireAdmin = (req,res,next) => (req.session.user?.role==='admin') ? next() : res.status(403).json({error:'Admin only'});

// ── SYNC: load all data ──
router.get('/sync', requireAuth, async (req,res) => {
  try {
    const uid     = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    const projQ   = isAdmin
      ? pool.query('SELECT * FROM lats_projects ORDER BY id')
      : pool.query('SELECT * FROM lats_projects WHERE $1 = ANY(assigned_users) ORDER BY id', [uid]);

    const [proj,vils,p3a,p3ag,pjm,pjmg,p3d,p3dg,p3g,p3gg] = await Promise.all([
      projQ,
      pool.query('SELECT * FROM lats_villages ORDER BY id'),
      pool.query('SELECT * FROM lats_p3a ORDER BY id'),
      pool.query('SELECT * FROM lats_p3a_guts ORDER BY id'),
      pool.query('SELECT * FROM lats_pjm ORDER BY id'),
      pool.query('SELECT * FROM lats_pjm_guts ORDER BY id'),
      pool.query('SELECT * FROM lats_p3d ORDER BY id'),
      pool.query('SELECT * FROM lats_p3d_guts ORDER BY id'),
      pool.query('SELECT * FROM lats_p3g ORDER BY id'),
      pool.query('SELECT * FROM lats_p3g_guts ORDER BY id'),
    ]);
    res.json({
      projects: proj.rows, villages: vils.rows,
      p3a: p3a.rows, p3aGuts: p3ag.rows,
      pjm: pjm.rows, pjmGuts: pjmg.rows,
      p3d: p3d.rows, p3dGuts: p3dg.rows,
      p3g: p3g.rows, p3gGuts: p3gg.rows,
    });
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// ── BULK SAVE: upsert entire DB state atomically ──
router.post('/save', requireAuth, async (req,res) => {
  const d = req.body;
  if (!d) return res.status(400).json({error:'No data'});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Helper: upsert array
    const ups = async (table, cols, vals, idCol='id') => {
      if (!vals || !vals.length) return;
      for (const v of vals) {
        const placeholders = cols.map((_,i)=>`$${i+1}`).join(',');
        const updates = cols.filter(c=>c!==idCol).map((c,i)=>`${c}=$${cols.indexOf(c)+1}`).join(',');
        await client.query(
          `INSERT INTO ${table}(${cols.join(',')}) VALUES(${placeholders}) ON CONFLICT(${idCol}) DO UPDATE SET ${updates}`,
          cols.map(c=>v[c]??null)
        );
      }
    };

    // Projects
    await ups('lats_projects',
      ['id','name','tafs_no','length','tpc','civil_cost','la_cost','total_land','avail_land','la_required','la_length','la_length_tafs','approval_date','assigned_users'],
      (d.projects||[]).map(p=>({
        id:p.id, name:p.name, tafs_no:p.tafsNo||null, length:p.length||null, tpc:p.tpc||null,
        civil_cost:p.civilCost||null, la_cost:p.laCost||null, total_land:p.totalLand||null,
        avail_land:p.availLand||null, la_required:p.laRequired||null, la_length:p.laLength||null,
        approval_date:p.approvalDate||null, assigned_users:p.assignedUsers||[]
      }))
    );

    // Villages
    await ups('lats_villages',['id','project_id','name','taluka','is_addl'],
      (d.villages||[]).map(v=>({id:v.id,project_id:v.projectId,name:v.name,taluka:v.taluka||null,is_addl:v.isAddl||false}))
    );

    // P3a
    await ups('lats_p3a',['id','project_id','village_id','ptype','notif_date','cala_post','cala_name','cala_mobile','la_length_3a','is_addl'],
      (d.process3a||[]).map(x=>({id:x.id,project_id:x.projectId,village_id:x.villageId,ptype:x.type,
        notif_date:x.notifDate||null,cala_post:x.calaPost||null,cala_name:x.calaName||null,
        cala_mobile:x.calaMobile||null,la_length_3a:x.laLength3a||null,is_addl:x.isAdditional||false}))
    );
    await ups('lats_p3a_guts',['id','p3a_id','gut_number','area','land_type'],
      (d.process3aGuts||[]).map(g=>({id:g.id,p3a_id:g.process3aId,gut_number:g.gutNumber,area:g.area||null,land_type:g.landType||'Private Land'}))
    );

    // PJM
    await ups('lats_pjm',['id','project_id','village_id','jm_date','sheet_date','la_length_jm'],
      (d.processJM||[]).map(x=>({id:x.id,project_id:x.projectId,village_id:x.villageId,jm_date:x.jmDate||null,sheet_date:x.sheetDate||null,la_length_jm:x.laLengthJm||null}))
    );
    await ups('lats_pjm_guts',['id','pjm_id','gut_number','mod_area'],
      (d.processJMGuts||[]).map(g=>({id:g.id,pjm_id:g.processJMId,gut_number:g.gutNumber,mod_area:g.modArea||null}))
    );

    // P3D
    await ups('lats_p3d',['id','project_id','village_id','notif_date','la_length_3d'],
      (d.process3D||[]).map(x=>({id:x.id,project_id:x.projectId,village_id:x.villageId,notif_date:x.notifDate||null,la_length_3d:x.laLength3d||null}))
    );
    await ups('lats_p3d_guts',['id','p3d_id','gut_number','area','beneficiary','land_type'],
      (d.process3DGuts||[]).map(g=>({id:g.id,p3d_id:g.process3DId,gut_number:g.gutNumber,area:g.area||null,beneficiary:g.beneficiary||null,land_type:g.landType||'Private Land'}))
    );

    // P3G
    await ups('lats_p3g',['id','project_id','village_id','notif_date','la_length_3g'],
      (d.process3G||[]).map(x=>({id:x.id,project_id:x.projectId,village_id:x.villageId,notif_date:x.notifDate||null,la_length_3g:x.laLength3g||null}))
    );
    await ups('lats_p3g_guts',['id','p3g_id','gut_number','compensation','land_type'],
      (d.process3GGuts||[]).map(g=>({id:g.id,p3g_id:g.process3GId,gut_number:g.gutNumber,compensation:g.compensation||null,land_type:g.landType||'Private Land'}))
    );

    // Deletions — remove rows no longer present in frontend
    const del = async (table, ids, col='id') => {
      if (ids.length) await client.query(`DELETE FROM ${table} WHERE ${col} != ALL($1::int[])`, [ids]);
      else            await client.query(`DELETE FROM ${table}`);
    };
    await del('lats_p3g_guts',  (d.process3GGuts||[]).map(g=>g.id));
    await del('lats_p3g',       (d.process3G||[]).map(x=>x.id));
    await del('lats_p3d_guts',  (d.process3DGuts||[]).map(g=>g.id));
    await del('lats_p3d',       (d.process3D||[]).map(x=>x.id));
    await del('lats_pjm_guts',  (d.processJMGuts||[]).map(g=>g.id));
    await del('lats_pjm',       (d.processJM||[]).map(x=>x.id));
    await del('lats_p3a_guts',  (d.process3aGuts||[]).map(g=>g.id));
    await del('lats_p3a',       (d.process3a||[]).map(x=>x.id));
    await del('lats_villages',  (d.villages||[]).map(v=>v.id));
    await del('lats_projects',  (d.projects||[]).map(p=>p.id));

    await client.query('COMMIT');
    res.json({ok:true});
  } catch(e) {
    await client.query('ROLLBACK');
    console.error('Save error:',e);
    res.status(500).json({error:e.message});
  } finally { client.release(); }
});

module.exports = router;
