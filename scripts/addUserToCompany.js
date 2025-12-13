/**
 * Script to add a user to multiple companies
 * This allows a single user account to access multiple tenants/companies
 * 
 * Usage: node scripts/addUserToCompany.js
 */

const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/subscriptiontracker';
  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    
    // Get user email
    const email = await question('Enter user email: ');
    
    // Check if user exists
    const existingUser = await db.collection('login').findOne({ email });
    if (!existingUser) {
      console.log('\n❌ User not found. Please create the user first via signup.');
      rl.close();
      return;
    }

    console.log(`\n✅ Found user: ${existingUser.fullName || email}`);
    console.log(`   Current companies:`);
    
    const userCompanies = await db.collection('login').find({ email }).toArray();
    userCompanies.forEach((company, idx) => {
      console.log(`   ${idx + 1}. ${company.companyName || company.tenantId} (${company.tenantId})`);
    });

    console.log('\n📝 Adding user to a new company...\n');

    // Get new company details
    const newTenantId = await question('Enter new company/tenant ID: ');
    const companyName = await question('Enter company name: ');

    // Check if user already has access
    const hasAccess = await db.collection('login').findOne({ email, tenantId: newTenantId });
    if (hasAccess) {
      console.log('\n⚠️  User already has access to this company.');
      rl.close();
      return;
    }

    // Create new login record
    const newRecord = {
      email: existingUser.email,
      password: existingUser.password, // Same password hash
      tenantId: newTenantId,
      companyName: companyName,
      fullName: existingUser.fullName,
      defaultCurrency: existingUser.defaultCurrency || 'USD',
      createdAt: new Date()
    };

    await db.collection('login').insertOne(newRecord);
    
    console.log('\n✅ Successfully added user to new company!');
    console.log(`   User ${email} can now access ${companyName} (${newTenantId})`);
    console.log('\n💡 The user can switch companies using the company switcher in the sidebar.\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    rl.close();
  }
}

main();
