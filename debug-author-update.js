const processAO3Job = require('./src/shared/recUtils/processAO3Job.js').default;
const { Recommendation } = require('./src/models');

async function testAuthorUpdate() {
  try {
    // Find a recommendation to test with
    const rec = await Recommendation.findOne({
      order: [['id', 'DESC']],
      attributes: ['id', 'ao3ID', 'url', 'author', 'authors', 'title']
    });
    
    if (!rec) {
      console.log('No recommendations found');
      return;
    }
    
    console.log('Testing author update for:', {
      id: rec.id,
      ao3ID: rec.ao3ID,
      currentAuthor: rec.author,
      currentAuthors: rec.authors,
      title: rec.title
    });
    
    // Trigger an update
    const result = await processAO3Job({
      url: rec.url,
      ao3ID: rec.ao3ID,
      user: { id: 'test-user' },
      isUpdate: true
    });
    
    console.log('Update result:', result);
    
    // Check the recommendation after update
    await rec.reload();
    console.log('After update:', {
      author: rec.author,
      authors: rec.authors
    });
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testAuthorUpdate();