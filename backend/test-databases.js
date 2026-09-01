const db = require('./config/database');

async function main() {
    console.log('\n=== COMPANY REGISTRY ===');

    const companies = await db.master.query(
        'SELECT id, name, database_name, status FROM companies ORDER BY id'
    );

    console.table(companies.rows);

    console.log('\n=== COMPANY DATABASE TEST ===');

    for (const id of [1, 2, 3]) {
        try {
            const result = await db.forCompany(id).query(
                'SELECT COUNT(*) AS count FROM item_master'
            );

            console.log(`Company ${id}: ${result.rows[0].count} items`);
            console.log(`Path: ${db.getDbPath(id)}`);
        } catch (error) {
            console.log(`Company ${id} ERROR: ${error.message}`);
        }
    }
}

main().catch(error => {
    console.error('\nFATAL ERROR:', error);
    process.exit(1);
});
