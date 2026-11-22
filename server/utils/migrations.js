const Planner = require('../models/planner');

const runMigrations = async () => {
    const result = await Planner.collection.updateMany(
        { tasks: { $elemMatch: { taskType: { $exists: false } } } },
        { $set: { 'tasks.$[entry].taskType': 'task' } },
        { arrayFilters: [{ 'entry.taskType': { $exists: false } }] }
    );
    if (result.modifiedCount) console.log(`Migrated ${result.modifiedCount} planner documents to typed task references`);
};

module.exports = runMigrations;
