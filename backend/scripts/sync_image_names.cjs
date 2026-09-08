const pool = require('../config/db.cjs');
const fs = require('fs');
const path = require('path');

const store = path.join(__dirname, '..', '..', 'image-search-service', 'image-store');
const diskFiles = fs.readdirSync(store).filter(f => f !== '.cache');
const diskMap = new Map(); // base name -> full disk filename
diskFiles.forEach(f => {
  const base = path.parse(f).name.toLowerCase();
  diskMap.set(base, f);
  diskMap.set(f.toLowerCase(), f);
});

async function run(apply = false) {
  console.log(`=== SYNCING IMAGE NAMES IN DATABASE (Apply: ${apply}) ===\n`);
  
  // 1. stock_master
  const [stocks] = await pool.query('SELECT uid, design_number, image_filename, gallery_images FROM stock_master');
  let stockUpdatedCount = 0;
  for (const s of stocks) {
    let changed = false;
    let newImg = s.image_filename;
    let newGallery = s.gallery_images;
    
    if (s.image_filename) {
      const base = path.parse(s.image_filename).name.toLowerCase();
      if (diskMap.has(base) && diskMap.get(base) !== s.image_filename) {
        newImg = diskMap.get(base);
        changed = true;
      }
    }
    
    if (s.gallery_images) {
      try {
        const arr = JSON.parse(s.gallery_images);
        let gChanged = false;
        const updatedArr = arr.map(gf => {
          const gBase = path.parse(gf).name.toLowerCase();
          if (diskMap.has(gBase) && diskMap.get(gBase) !== gf) {
            gChanged = true;
            return diskMap.get(gBase);
          }
          return gf;
        });
        if (gChanged) {
          newGallery = JSON.stringify(updatedArr);
          changed = true;
        }
      } catch (e) {}
    }
    
    if (changed) {
      stockUpdatedCount++;
      console.log(`[stock_master] Design #${s.design_number}:`);
      if (newImg !== s.image_filename) console.log(`   image_filename: "${s.image_filename}" -> "${newImg}"`);
      if (newGallery !== s.gallery_images) console.log(`   gallery_images: ${s.gallery_images} -> ${newGallery}`);
      
      if (apply) {
        await pool.query('UPDATE stock_master SET image_filename = ?, gallery_images = ? WHERE uid = ?', [newImg, newGallery, s.uid]);
      }
    }
  }

  // 2. order_items
  const [orders] = await pool.query('SELECT uid, design_number, image_filename FROM order_items');
  let ordersUpdatedCount = 0;
  for (const o of orders) {
    if (o.image_filename) {
      const base = path.parse(o.image_filename).name.toLowerCase();
      if (diskMap.has(base) && diskMap.get(base) !== o.image_filename) {
        ordersUpdatedCount++;
        const newImg = diskMap.get(base);
        console.log(`[order_items] ID ${o.uid} (Design #${o.design_number}):`);
        console.log(`   image_filename: "${o.image_filename}" -> "${newImg}"`);
        
        if (apply) {
          await pool.query('UPDATE order_items SET image_filename = ? WHERE uid = ?', [newImg, o.uid]);
        }
      }
    }
  }

  // 3. user_master
  const [users] = await pool.query('SELECT uid, username, profile_picture FROM user_master');
  let usersUpdatedCount = 0;
  for (const u of users) {
    if (u.profile_picture) {
      const base = path.parse(u.profile_picture).name.toLowerCase();
      if (diskMap.has(base) && diskMap.get(base) !== u.profile_picture) {
        usersUpdatedCount++;
        const newPic = diskMap.get(base);
        console.log(`[user_master] Username ${u.username}:`);
        console.log(`   profile_picture: "${u.profile_picture}" -> "${newPic}"`);
        
        if (apply) {
          await pool.query('UPDATE user_master SET profile_picture = ? WHERE uid = ?', [newPic, u.uid]);
        }
      }
    }
  }

  console.log(`\nSummary:`);
  console.log(`- stock_master rows updated: ${stockUpdatedCount}`);
  console.log(`- order_items rows updated: ${ordersUpdatedCount}`);
  console.log(`- user_master rows updated: ${usersUpdatedCount}`);
  if (apply) {
    console.log('\nAll updates applied successfully to the database!');
  } else {
    console.log('\nDry run complete. No database changes were written.');
  }

  process.exit(0);
}

const applyFlag = process.argv.includes('--apply');
run(applyFlag).catch(err => {
  console.error('Error during sync:', err);
  process.exit(1);
});
