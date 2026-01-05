import { getDb } from '../server/db';
import { wMatrixVersions, latentVectors } from '../drizzle/schema';

async function main() {
  const db = await getDb();
  
  console.log('=== Database Data Check ===\n');
  
  // Check W-Matrix versions
  const wMatrices = await db.select().from(wMatrixVersions);
  console.log(`W-Matrix Versions: ${wMatrices.length}`);
  if (wMatrices.length > 0) {
    console.log('Sample:', {
      id: wMatrices[0].id,
      sourceModel: wMatrices[0].sourceModel,
      targetModel: wMatrixVersions[0].targetModel,
      epsilon: wMatrices[0].epsilon,
    });
  }
  
  // Check latent vectors
  const vectors = await db.select().from(latentVectors);
  console.log(`\nLatent Vectors: ${vectors.length}`);
  if (vectors.length > 0) {
    console.log('Sample:', {
      id: vectors[0].id,
      name: vectors[0].name,
      category: vectors[0].category,
    });
  }
}

main();
