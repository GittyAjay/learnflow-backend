import { googleScraperService } from './services/googleScraperService';

async function testScraper() {
  try {
    console.log('Testing Google Video Scraper...');
    
    const testQuery = 'JavaScript basics tutorial';
    
    console.log(`Searching for: "${testQuery}"`);
    
    // Test getting the best video
    console.log('\n--- Testing getBestVideo ---');
    const bestVideo = await googleScraperService.getBestVideo(testQuery);
    
    if (bestVideo) {
      console.log('Best video found:');
      console.log('Title:', bestVideo.title);
      console.log('URL:', bestVideo.url);
      console.log('Description:', bestVideo.description);
      console.log('Duration:', bestVideo.duration || 'N/A');
      console.log('Channel:', bestVideo.channel || 'N/A');
      console.log('Views:', bestVideo.views || 'N/A');
    } else {
      console.log('No best video found');
    }
    
    // Test getting multiple video options
    console.log('\n--- Testing searchVideos ---');
    const videos = await googleScraperService.searchVideos(testQuery, 3);
    
    console.log(`Found ${videos.length} videos:`);
    videos.forEach((video, index) => {
      console.log(`\n${index + 1}. ${video.title}`);
      console.log(`   URL: ${video.url}`);
      console.log(`   Description: ${video.description}`);
      console.log(`   Duration: ${video.duration || 'N/A'}`);
      console.log(`   Channel: ${video.channel || 'N/A'}`);
      console.log(`   Views: ${video.views || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Close the browser
    await googleScraperService.close();
    console.log('\nTest completed. Browser closed.');
  }
}

// Run the test
testScraper(); 