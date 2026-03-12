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

    const [proj,vils,p3a,p3ag,pjm,pjmg,p3d,p3dg,p3g,p3gg,stTal,perms] = await Promise.all([
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
      pool.query('SELECT * FROM lats_stretch_talukas ORDER BY stretch_id, sort_order'),
      pool.query('SELECT * FROM lats_user_permissions ORDER BY user_id'),
    ]);
    res.json({
      projects: proj.rows, villages: vils.rows,
      p3a: p3a.rows, p3aGuts: p3ag.rows,
      pjm: pjm.rows, pjmGuts: pjmg.rows,
      p3d: p3d.rows, p3dGuts: p3dg.rows,
      p3g: p3g.rows, p3gGuts: p3gg.rows,
      stretchTalukas: stTal.rows,
      userPermissions: perms.rows,
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
      ['id','name','tafs_no','tafs_date','length','tpc','civil_cost','la_cost','total_land','avail_land','la_required','la_length','la_length_tafs','approval_date','assigned_users'],
      (d.projects||[]).map(p=>({
        id:p.id, name:p.name, tafs_no:p.tafsNo||null, tafs_date:p.tafsDate||null, length:p.length||null, tpc:p.tpc||null,
        civil_cost:p.civilCost||null, la_cost:p.laCost||null, total_land:p.totalLand||null,
        avail_land:p.availLand||null, la_required:p.laRequired||null, la_length:p.laLength||null,
        la_length_tafs:p.laLengthTafs||null,
        approval_date:p.approvalDate||null, assigned_users:p.assignedUsers||[]
      }))
    );

    // Villages
    await ups('lats_villages',['id','project_id','name','taluka','is_addl'],
      (d.villages||[]).map(v=>({id:v.id,project_id:v.projectId,name:v.name,taluka:v.taluka||null,is_addl:v.isAddl||false}))
    );

    // P3a
    await ups('lats_p3a',['id','project_id','village_id','ptype','notif_date','cala_post','cala_name','cala_mobile','la_length_3a','sr_no','sr_name'],
      (d.process3a||[]).map(x=>({id:x.id,project_id:x.projectId,village_id:x.villageId,ptype:x.type,
        notif_date:x.notifDate||null,cala_post:x.calaPost||null,cala_name:x.calaName||null,
        cala_mobile:x.calaMobile||null,la_length_3a:x.laLength3a||null,sr_no:x.srNo||1,sr_name:x.srName||'Main'}))
    );
    await ups('lats_p3a_guts',['id','p3a_id','gut_number','area','land_type'],
      (d.process3aGuts||[]).map(g=>({id:g.id,p3a_id:g.process3aId,gut_number:g.gutNumber,area:g.area||null,land_type:g.landType||'Private Land'}))
    );

    // PJM
    await ups('lats_pjm',['id','project_id','village_id','jm_date','sheet_date','la_length_jm','sr_no','sr_name'],
      (d.processJM||[]).map(x=>({id:x.id,project_id:x.projectId,village_id:x.villageId,jm_date:x.jmDate||null,sheet_date:x.sheetDate||null,la_length_jm:x.laLengthJm||null,sr_no:x.srNo||1,sr_name:x.srName||'Main'}))
    );
    await ups('lats_pjm_guts',['id','pjm_id','gut_number','mod_area'],
      (d.processJMGuts||[]).map(g=>({id:g.id,pjm_id:g.processJMId,gut_number:g.gutNumber,mod_area:g.modArea||null}))
    );

    // P3D
    await ups('lats_p3d',['id','project_id','village_id','notif_date','la_length_3d','sr_no','sr_name'],
      (d.process3D||[]).map(x=>({id:x.id,project_id:x.projectId,village_id:x.villageId,notif_date:x.notifDate||null,la_length_3d:x.laLength3d||null,sr_no:x.srNo||1,sr_name:x.srName||'Main'}))
    );
    await ups('lats_p3d_guts',['id','p3d_id','gut_number','area','beneficiary','land_type'],
      (d.process3DGuts||[]).map(g=>({id:g.id,p3d_id:g.process3DId,gut_number:g.gutNumber,area:g.area||null,beneficiary:g.beneficiary||null,land_type:g.landType||'Private Land'}))
    );

    // P3G
    await ups('lats_p3g',['id','project_id','village_id','notif_date','la_length_3g','sr_no','sr_name'],
      (d.process3G||[]).map(x=>({id:x.id,project_id:x.projectId,village_id:x.villageId,notif_date:x.notifDate||null,la_length_3g:x.laLength3g||null,sr_no:x.srNo||1,sr_name:x.srName||'Main'}))
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


// ══════════════════════════════════════════════════════
// NH MANAGEMENT MODULE
// ══════════════════════════════════════════════════════

// Project Types
router.get('/nh/project-types', requireAuth, async (req,res) => {
  try {
    const r = await pool.query('SELECT * FROM lats_project_types ORDER BY name');
    res.json(r.rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/nh/project-types', requireAdmin, async (req,res) => {
  try {
    const {name} = req.body;
    const r = await pool.query('INSERT INTO lats_project_types(name) VALUES($1) RETURNING *',[name]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.put('/nh/project-types/:id', requireAdmin, async (req,res) => {
  try {
    const {name} = req.body;
    const r = await pool.query('UPDATE lats_project_types SET name=$1 WHERE id=$2 RETURNING *',[name,req.params.id]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.delete('/nh/project-types/:id', requireAdmin, async (req,res) => {
  try {
    await pool.query('DELETE FROM lats_project_types WHERE id=$1',[req.params.id]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// NH Numbers
router.get('/nh', requireAuth, async (req,res) => {
  try {
    const r = await pool.query('SELECT * FROM lats_nh ORDER BY id');
    res.json(r.rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/nh', requireAdmin, async (req,res) => {
  try {
    const {nh_number,description,chainage_from,chainage_to,length,state} = req.body;
    const r = await pool.query(
      'INSERT INTO lats_nh(nh_number,description,chainage_from,chainage_to,length,state) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [nh_number,description||null,chainage_from||null,chainage_to||null,length||null,state||null]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.put('/nh/:id', requireAdmin, async (req,res) => {
  try {
    const {nh_number,description,chainage_from,chainage_to,length,state} = req.body;
    const r = await pool.query(
      'UPDATE lats_nh SET nh_number=$1,description=$2,chainage_from=$3,chainage_to=$4,length=$5,state=$6 WHERE id=$7 RETURNING *',
      [nh_number,description||null,chainage_from||null,chainage_to||null,length||null,state||null,req.params.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.delete('/nh/:id', requireAdmin, async (req,res) => {
  try {
    await pool.query('DELETE FROM lats_nh WHERE id=$1',[req.params.id]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// NH Stretches
router.get('/nh/:nhId/stretches', requireAuth, async (req,res) => {
  try {
    const r = await pool.query('SELECT * FROM lats_nh_stretches WHERE nh_id=$1 ORDER BY chainage_from',[req.params.nhId]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/nh/:nhId/stretches', requireAdmin, async (req,res) => {
  try {
    const {name,chainage_from,chainage_to,length,description,district,taluka,division,project_id} = req.body;
    const r = await pool.query(
      'INSERT INTO lats_nh_stretches(nh_id,name,chainage_from,chainage_to,length,description,district,taluka,division,project_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [req.params.nhId,name||null,chainage_from||null,chainage_to||null,length||null,description||null,district||null,taluka||null,division||null,project_id||null]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.put('/nh/stretches/:id', requireAdmin, async (req,res) => {
  try {
    const {name,chainage_from,chainage_to,length,description,district,taluka,division,project_id} = req.body;
    const r = await pool.query(
      'UPDATE lats_nh_stretches SET name=$1,chainage_from=$2,chainage_to=$3,length=$4,description=$5,district=$6,taluka=$7,division=$8,project_id=$9 WHERE id=$10 RETURNING *',
      [name||null,chainage_from||null,chainage_to||null,length||null,description||null,district||null,taluka||null,division||null,project_id||null,req.params.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.delete('/nh/stretches/:id', requireAdmin, async (req,res) => {
  try {
    await pool.query('DELETE FROM lats_nh_stretches WHERE id=$1',[req.params.id]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Contracts
router.get('/nh/contracts/all', requireAuth, async (req,res) => {
  try {
    const r = await pool.query('SELECT * FROM lats_contracts ORDER BY id');
    res.json(r.rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/nh/contracts', requireAdmin, async (req,res) => {
  try {
    const d = req.body;
    const pct = (d.cost_put_to_tender && d.contract_price)
      ? (1 - parseFloat(d.contract_price)/parseFloat(d.cost_put_to_tender))
      : null;
    const r = await pool.query(
      `INSERT INTO lats_contracts(project_id,stretch_id,project_type_id,contractor_name,contractor_address,contractor_contact,
        cost_put_to_tender,contract_price,pct_above_below,agreement_date,appointed_date,schedule_completion,eot_date,dlp_date,remarks)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [d.project_id||null,d.stretch_id||null,d.project_type_id||null,d.contractor_name||null,d.contractor_address||null,
       d.contractor_contact||null,d.cost_put_to_tender||null,d.contract_price||null,pct,
       d.agreement_date||null,d.appointed_date||null,d.schedule_completion||null,d.eot_date||null,d.dlp_date||null,d.remarks||null]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.put('/nh/contracts/:id', requireAdmin, async (req,res) => {
  try {
    const d = req.body;
    const pct = (d.cost_put_to_tender && d.contract_price)
      ? (1 - parseFloat(d.contract_price)/parseFloat(d.cost_put_to_tender))
      : null;
    const r = await pool.query(
      `UPDATE lats_contracts SET project_id=$1,stretch_id=$2,project_type_id=$3,contractor_name=$4,contractor_address=$5,
        contractor_contact=$6,cost_put_to_tender=$7,contract_price=$8,pct_above_below=$9,agreement_date=$10,
        appointed_date=$11,schedule_completion=$12,eot_date=$13,dlp_date=$14,remarks=$15 WHERE id=$16 RETURNING *`,
      [d.project_id||null,d.stretch_id||null,d.project_type_id||null,d.contractor_name||null,d.contractor_address||null,
       d.contractor_contact||null,d.cost_put_to_tender||null,d.contract_price||null,pct,
       d.agreement_date||null,d.appointed_date||null,d.schedule_completion||null,d.eot_date||null,d.dlp_date||null,d.remarks||null,req.params.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.delete('/nh/contracts/:id', requireAdmin, async (req,res) => {
  try {
    await pool.query('DELETE FROM lats_contracts WHERE id=$1',[req.params.id]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// User division update
router.put('/auth/users/:id/division', requireAdmin, async (req,res) => {
  try {
    const r = await pool.query('UPDATE lats_users SET division=$1 WHERE id=$2 RETURNING id,username,name,role,division',[req.body.division||null,req.params.id]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});


// Stretch Taluka Rows
router.get('/nh/stretches/:stretchId/talukas', requireAuth, async (req,res) => {
  try {
    const r = await pool.query('SELECT * FROM lats_stretch_talukas WHERE stretch_id=$1 ORDER BY sort_order,chainage_from',[req.params.stretchId]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});

router.post('/nh/stretches/:stretchId/talukas', requireAdmin, async (req,res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM lats_stretch_talukas WHERE stretch_id=$1',[req.params.stretchId]);
    const rows = req.body.rows || [];
    for (let i=0; i<rows.length; i++) {
      const r = rows[i];
      await client.query(
        'INSERT INTO lats_stretch_talukas(stretch_id,district,taluka,chainage_from,chainage_to,length,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [req.params.stretchId, r.district||null, r.taluka||null, r.chainage_from||null, r.chainage_to||null, r.length||null, i]
      );
    }
    await client.query('COMMIT');
    const updated = await pool.query('SELECT * FROM lats_stretch_talukas WHERE stretch_id=$1 ORDER BY sort_order',[req.params.stretchId]);
    res.json(updated.rows);
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({error:e.message});
  } finally { client.release(); }
});


// ── User Permissions ──
router.get('/permissions/:userId', requireAuth, async (req,res) => {
  try {
    const r = await pool.query('SELECT * FROM lats_user_permissions WHERE user_id=$1',[req.params.userId]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});

router.post('/permissions/:userId', requireAdmin, async (req,res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const perms = req.body.permissions || [];
    for (const p of perms) {
      await client.query(
        `INSERT INTO lats_user_permissions(user_id,module,can_view,can_edit,can_delete)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(user_id,module) DO UPDATE SET can_view=$3,can_edit=$4,can_delete=$5`,
        [req.params.userId, p.module, p.can_view, p.can_edit, p.can_delete]
      );
    }
    await client.query('COMMIT');
    const updated = await pool.query('SELECT * FROM lats_user_permissions WHERE user_id=$1',[req.params.userId]);
    res.json(updated.rows);
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({error:e.message});
  } finally { client.release(); }
});

module.exports = router;
