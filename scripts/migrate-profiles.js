// scripts/migrate-profiles.js
import { prisma } from "../lib/prisma.js";
import { readFileSync } from 'fs';

async function migrateProfiles() {
  try {
    console.log('🚀 Starting profile migration...');
    
    // Read existing profiles from JSON file
    const profilesData = JSON.parse(readFileSync('./class-profiles.json', 'utf8'));
    
    for (const profile of profilesData.profiles) {
      console.log(`📝 Migrating profile: ${profile.name}`);
      
      // Check if profile already exists
      const existing = await prisma.classProfile.findFirst({
        where: { name: profile.name }
      });
      
      if (existing) {
        console.log(`⚠️  Profile "${profile.name}" already exists, skipping...`);
        continue;
      }
      
      // Create new profile in database
      await prisma.classProfile.create({
        data: {
          id: profile.id, // Use existing ID for consistency
          name: profile.name,
          cefrLevel: profile.cefrLevel,
          vocabulary: profile.vocabulary,
          grammar: profile.grammar,
          prompt: profile.prompt || '',
          created: new Date(profile.created),
          lastModified: new Date(profile.lastModified),
        }
      });
      
      console.log(`✅ Successfully migrated: ${profile.name}`);
    }
    
    console.log('🎉 Migration completed successfully!');
    
    // Show all profiles in database
    const allProfiles = await prisma.classProfile.findMany();
    console.log(`\n📊 Total profiles in database: ${allProfiles.length}`);
    allProfiles.forEach(p => console.log(`  - ${p.name} (${p.cefrLevel})`));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateProfiles();