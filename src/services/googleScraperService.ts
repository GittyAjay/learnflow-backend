import puppeteer, { Browser } from 'puppeteer';
import { YoutubeTranscript } from 'youtube-transcript';

export interface VideoResult {
  title: string;
  url: string;
  description: string;
  duration?: string;
  channel?: string;
  views?: string;
}

export interface TranscriptData {
  transcript: string;
  language: string;
  videoId: string;
  title?: string;
}

export class GoogleScraperService {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async searchVideos(query: string, maxResults: number = 5): Promise<VideoResult[]> {
    await this.initialize();
    
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to Google search with video filter
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=vid`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for any video results to load with multiple possible selectors
      try {
        await page.waitForSelector('div[data-ved]', { timeout: 5000 });
      } catch (error) {
        try {
          await page.waitForSelector('.g', { timeout: 5000 });
        } catch (error2) {
          try {
            await page.waitForSelector('a[href*="youtube.com"]', { timeout: 5000 });
          } catch (error3) {
            // If all selectors fail, just wait a bit and proceed
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      // Use page.evaluate to extract video data directly from the DOM
      const videoData = await page.evaluate(() => {
        const videos: any[] = [];
        
        // Find all video result containers with multiple selectors
        const selectors = ['div[data-ved]', '.g', '.rc', '.video-result', '.search-result'];
        let videoContainers: NodeListOf<Element> | null = null;
        
        for (const selector of selectors) {
          videoContainers = document.querySelectorAll(selector);
          if (videoContainers.length > 0) break;
        }
        
        // If no containers found, look for any YouTube links on the page
        if (!videoContainers || videoContainers.length === 0) {
          const allLinks = document.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]');
          allLinks.forEach((link) => {
            if (videos.length >= 5) return;
            
            const linkElement = link as HTMLAnchorElement;
            const url = linkElement.href;
            const title = linkElement.textContent?.trim() || '';
            
            if (url && title && title.length > 3) { // Reduced minimum length from 5 to 3
              videos.push({
                title: title,
                url: url,
                description: 'Video found from Google search',
                duration: undefined,
                channel: undefined,
                views: undefined
              });
            }
          });
          
          return videos;
        }
        
        videoContainers.forEach((container) => {
          if (videos.length >= 5) return;
          
          const containerElement = container as HTMLElement;
          
          // Find YouTube links
          const youtubeLinks = containerElement.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]');
          
          youtubeLinks.forEach((link) => {
            if (videos.length >= 5) return;
            
            const linkElement = link as HTMLAnchorElement;
            const url = linkElement.href;
            
            if (url) {
              // Find title - try multiple selectors
              let title = '';
              const titleSelectors = ['h3', '.title', '.LC20lb', '.DKV0Md', '.video-title', '.result-title'];
              
              for (const selector of titleSelectors) {
                const titleElement = containerElement.querySelector(selector);
                if (titleElement) {
                  title = titleElement.textContent?.trim() || '';
                  if (title) break;
                }
              }
              
              // If no title found in container, use link text
              if (!title) {
                title = linkElement.textContent?.trim() || '';
              }
              
              // Find description
              let description = '';
              const descSelectors = ['.snippet', '.description', '.content', '.VwiC3b', '.yXK7lf', '.result-snippet'];
              
              for (const selector of descSelectors) {
                const descElement = containerElement.querySelector(selector);
                if (descElement) {
                  description = descElement.textContent?.trim() || '';
                  if (description) break;
                }
              }
              
              // Find duration
              let duration = '';
              const durationSelectors = ['.duration', '.time', '.LwV2X', '.video-duration', '.result-duration'];
              
              for (const selector of durationSelectors) {
                const durationElement = containerElement.querySelector(selector);
                if (durationElement) {
                  duration = durationElement.textContent?.trim() || '';
                  if (duration) break;
                }
              }
              
              // Find channel
              let channel = '';
              const channelSelectors = ['.channel', '.author', '.C3nS9d', '.w1C7d', '.video-channel', '.result-channel'];
              
              for (const selector of channelSelectors) {
                const channelElement = containerElement.querySelector(selector);
                if (channelElement) {
                  channel = channelElement.textContent?.trim() || '';
                  if (channel) break;
                }
              }
              
              // Find views
              let views = '';
              const viewsSelectors = ['.views', '.view-count', '.video-views', '.result-views'];
              
              for (const selector of viewsSelectors) {
                const viewsElement = containerElement.querySelector(selector);
                if (viewsElement) {
                  views = viewsElement.textContent?.trim() || '';
                  if (views) break;
                }
              }
              
              if (title && title.length > 3) { // Reduced minimum length from 5 to 3
                videos.push({
                  title: title,
                  url: url,
                  description: description || 'No description available',
                  duration: duration || undefined,
                  channel: channel || undefined,
                  views: views || undefined
                });
              }
            }
          });
        });
        
        return videos;
      });

      // Process the extracted data
      const videos: VideoResult[] = (videoData || []).map(video => ({
        title: this.cleanTitle(video.title || ''),
        url: this.cleanUrl(video.url || ''),
        description: this.cleanDescription(video.description || ''),
        duration: video.duration || undefined,
        channel: video.channel || undefined,
        views: video.views || undefined
      }));

      return videos.slice(0, maxResults);

    } catch (error) {
      console.error('Error scraping Google videos:', error);
      throw new Error(`Failed to scrape videos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await page.close();
    }
  }

  private cleanTitle(title: string): string {
    // Remove extra concatenated text and clean up the title
    const lines = title.split(/(?=[A-Z][a-z])/);
    if (lines.length > 1) {
      // Take the first meaningful line
      return lines[0].trim();
    }
    return title.trim();
  }

  private cleanDescription(description: string): string {
    // Clean up description text
    return description.replace(/\s+/g, ' ').trim();
  }

  private cleanUrl(url: string): string {
    // Extract the actual YouTube URL from Google's redirect URL
    if (url.includes('/url?q=')) {
      const match = url.match(/\/url\?q=([^&]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
    return url;
  }

  async getBestVideo(query: string): Promise<VideoResult> {
    try {
      const videos = await this.searchVideos(query, 3);
      
      if (videos.length === 0) {
        throw new Error(`No videos found for query: ${query}`);
      }

      // Return the first video as the "best" one
      // In a more sophisticated implementation, you could rank them based on:
      // - View count
      // - Duration (prefer shorter videos for learning)
      // - Channel reputation
      // - Recency
      return videos[0];

    } catch (error) {
      console.error('Error getting best video:', error);
      throw error;
    }
  }

  // async getVideoTranscript(videoUrl: string, language: string = 'en'): Promise<TranscriptData> {
  //   await this.initialize();
    
  //   if (!this.browser) {
  //     throw new Error('Browser not initialized');
  //   }
  
  //   // Validate and extract video ID from URL or convert ID to URL
  //   let videoId: string;
  //   let cleanVideoUrl: string;
  
  //   // Check if it's already a video ID (11 characters, alphanumeric and hyphens/underscores)
  //   if (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl)) {
  //     videoId = videoUrl;
  //     cleanVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  //   } else {
  //     // Try to extract video ID from URL
  //     const videoIdMatch = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  //     if (!videoIdMatch || !videoIdMatch[1]) {
  //       throw new Error(`Invalid YouTube URL or video ID: ${videoUrl}`);
  //     }
  //     videoId = videoIdMatch[1];
  //     cleanVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  //   }
  
  //   const page = await this.browser.newPage();
    
  //   try {
  //     console.log(`Fetching transcript for video ID: ${videoId}`);
      
  //     // Set user agent and viewport
  //     await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  //     await page.setViewport({ width: 1920, height: 1080 });
      
  //     // Navigate to the video URL
  //     console.log(`Navigating to: ${cleanVideoUrl}`);
  //     await page.goto(cleanVideoUrl, { 
  //       waitUntil: 'domcontentloaded', 
  //       timeout: 30000 
  //     });
      
  //     // Wait for the page to load properly
  //     await page.waitForTimeout(3000);
      
  //     // Wait for video player to load
  //     await page.waitForSelector('#movie_player, .video-stream', { timeout: 15000 });
      
  //     // Get video title
  //     const title = await page.evaluate(() => {
  //       const titleSelectors = [
  //         '#title h1 yt-formatted-string',
  //         'h1.ytd-video-primary-info-renderer',
  //         '.title.ytd-video-primary-info-renderer',
  //         'h1[class*="title"]'
  //       ];
        
  //       for (const selector of titleSelectors) {
  //         const element = document.querySelector(selector);
  //         if (element?.textContent?.trim()) {
  //           return element.textContent.trim();
  //         }
  //       }
  //       return '';
  //     });
      
  //     // Scroll down to ensure all elements are loaded
  //     await page.evaluate(() => {
  //       window.scrollTo(0, 500);
  //     });
  //     await page.waitForTimeout(2000);
      
  //     // Try to find and expand description if needed
  //     try {
  //       const expandButton = await page.$('tp-yt-paper-button#expand, #expand, button[aria-label*="more"]');
  //       if (expandButton) {
  //         await expandButton.click();
  //         await page.waitForTimeout(1000);
  //         console.log('Expanded description section');
  //       }
  //     } catch (e) {
  //       console.log('Description expand not needed or not found');
  //     }
      
  //     // Enhanced transcript button detection with multiple strategies
  //     let transcriptButtonFound = false;
      
  //     // Strategy 1: Look for transcript button using comprehensive selectors
  //     const transcriptSelectors = [
  //       // New YouTube selectors (2024)
  //       'button[aria-label*="Show transcript"]',
  //       'button[aria-label*="Hide transcript"]',
  //       'yt-button-renderer[aria-label*="transcript"]',
  //       'yt-button-renderer[aria-label*="Transcript"]',
        
  //       // Alternative selectors
  //       'button[title*="transcript"]',
  //       'button[title*="Transcript"]',
  //       '#transcript-button',
  //       '.transcript-button',
  //       'button[data-target-id*="transcript"]',
        
  //       // Fallback selectors
  //       'button:has-text("Show transcript")',
  //       'button:has-text("Transcript")',
  //       'yt-formatted-string:has-text("Show transcript")',
        
  //       // More generic selectors
  //       'button[aria-expanded]',
  //       'yt-button-renderer[role="button"]'
  //     ];
      
  //     // Try each selector
  //     for (const selector of transcriptSelectors) {
  //       try {
  //         // Wait for potential buttons to appear
  //         await page.waitForTimeout(500);
          
  //         const buttons = await page.$$(selector);
          
  //         for (const button of buttons) {
  //           const buttonText = await button.evaluate(el => {
  //             const text = el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '';
  //             return text.toLowerCase();
  //           });
            
  //           if (buttonText.includes('transcript')) {
  //             console.log(`Found transcript button with selector: ${selector}, text: ${buttonText}`);
  //             await button.click();
  //             transcriptButtonFound = true;
  //             break;
  //           }
  //         }
          
  //         if (transcriptButtonFound) break;
          
  //       } catch (e) {
  //         continue;
  //       }
  //     }
      
  //     // Strategy 2: If no transcript button found, try right-click menu approach
  //     if (!transcriptButtonFound) {
  //       try {
  //         console.log('Trying right-click menu approach for transcript');
  //         await page.click('#movie_player', { button: 'right' });
  //         await page.waitForTimeout(1000);
          
  //         const transcriptMenuItem = await page.$('div[role="menuitem"]:has-text("Open transcript")');
  //         if (transcriptMenuItem) {
  //           await transcriptMenuItem.click();
  //           transcriptButtonFound = true;
  //           console.log('Found transcript via right-click menu');
  //         }
  //       } catch (e) {
  //         console.log('Right-click menu approach failed');
  //       }
  //     }
      
  //     // Strategy 3: Try using keyboard shortcut
  //     if (!transcriptButtonFound) {
  //       try {
  //         console.log('Trying keyboard shortcut approach');
  //         await page.focus('#movie_player');
  //         await page.keyboard.press('KeyT'); // YouTube keyboard shortcut for transcript
  //         await page.waitForTimeout(2000);
  //         transcriptButtonFound = true;
  //         console.log('Attempted transcript via keyboard shortcut');
  //       } catch (e) {
  //         console.log('Keyboard shortcut approach failed');
  //       }
  //     }
      
  //     if (!transcriptButtonFound) {
  //       // Check if captions are available at all
  //       const captionsAvailable = await page.evaluate(() => {
  //         const captionButton = document.querySelector('button.ytp-subtitles-button, .ytp-caption-button');
  //         return captionButton !== null;
  //       });
        
  //       if (!captionsAvailable) {
  //         throw new Error('No captions/subtitles available for this video');
  //       } else {
  //         throw new Error('Transcript button not found despite captions being available');
  //       }
  //     }
      
  //     // Wait for transcript panel to load with multiple possible selectors
  //     let transcriptLoaded = false;
  //     const transcriptPanelSelectors = [
  //       'ytd-transcript-segment-renderer',
  //       '.transcript-segment',
  //       '#transcript-scrollbox',
  //       '.ytd-transcript-segment-list-renderer',
  //       'div[role="log"]', // Sometimes transcript uses this role
  //       '.segment-text'
  //     ];
      
  //     for (const selector of transcriptPanelSelectors) {
  //       try {
  //         await page.waitForSelector(selector, { timeout: 5000 });
  //         transcriptLoaded = true;
  //         console.log(`Transcript loaded with selector: ${selector}`);
  //         break;
  //       } catch (e) {
  //         continue;
  //       }
  //     }
      
  //     if (!transcriptLoaded) {
  //       // Give it one more chance with a longer timeout
  //       await page.waitForTimeout(3000);
  //     }
      
  //     // Extract transcript text with multiple strategies
  //     const transcript = await page.evaluate(() => {
  //       const extractors = [
  //         // Modern YouTube transcript format
  //         () => {
  //           const segments = document.querySelectorAll('ytd-transcript-segment-renderer .segment-text');
  //           return Array.from(segments).map(seg => seg.textContent?.trim()).filter(Boolean).join(' ');
  //         },
          
  //         // Alternative format
  //         () => {
  //           const segments = document.querySelectorAll('.transcript-segment .segment-text');
  //           return Array.from(segments).map(seg => seg.textContent?.trim()).filter(Boolean).join(' ');
  //         },
          
  //         // Generic transcript text extraction
  //         () => {
  //           const transcriptContainer = document.querySelector('#transcript-scrollbox, .ytd-transcript-segment-list-renderer');
  //           if (transcriptContainer) {
  //             const textNodes = transcriptContainer.querySelectorAll('[role="button"], .segment-text, .cue-group-start-offset');
  //             return Array.from(textNodes)
  //               .map(node => node.textContent?.trim())
  //               .filter(text => text && text.length > 0 && !/^\d+:\d+$/.test(text)) // Filter out timestamps
  //               .join(' ');
  //           }
  //           return '';
  //         },
          
  //         // Fallback: look for any element with transcript-like content
  //         () => {
  //           const allElements = document.querySelectorAll('[class*="transcript"], [id*="transcript"]');
  //           for (const element of allElements) {
  //             const text = element.textContent?.trim();
  //             if (text && text.length > 100) { // Assume transcript should be reasonably long
  //               return text;
  //             }
  //           }
  //           return '';
  //         }
  //       ];
        
  //       for (const extractor of extractors) {
  //         try {
  //           const result = extractor();
  //           if (result && result.trim().length > 0) {
  //             return result.trim();
  //           }
  //         } catch (e) {
  //           continue;
  //         }
  //       }
        
  //       return '';
  //     });
      
  //     if (!transcript || transcript.trim().length === 0) {
  //       throw new Error('No transcript text could be extracted from the page');
  //     }
      
  //     // Clean up the transcript text
  //     const cleanedTranscript = transcript
  //       .replace(/\s+/g, ' ') // Normalize whitespace
  //       .replace(/\d{1,2}:\d{2}(?::\d{2})?\s*/g, '') // Remove timestamps
  //       .trim();
      
  //     if (cleanedTranscript.length < 10) {
  //       throw new Error('Extracted transcript is too short to be valid');
  //     }
      
  //     console.log(`Successfully extracted transcript (${cleanedTranscript.length} characters)`);
      
  //     return {
  //       transcript: cleanedTranscript,
  //       language,
  //       videoId,
  //       title
  //     };
      
  //   } catch (error) {
  //     console.error('Error in getVideoTranscript:', error);
      
  //     // Provide more specific error messages
  //     if (error instanceof Error) {
  //       if (error.message.includes('timeout')) {
  //         throw new Error('Timeout while loading video page. The video may be unavailable or too slow to load.');
  //       } else if (error.message.includes('not found')) {
  //         throw new Error('Video not found or may be private/restricted.');
  //       } else {
  //         throw new Error(`Failed to extract transcript: ${error.message}`);
  //       }
  //     }
      
  //     throw new Error('Unknown error occurred while extracting transcript');
  //   } finally {
  //     await page.close();
  //   }
  // }
// Add this method to your GoogleScraperService class
async getVideoTranscript(videoUrl: string, language: string = 'en'): Promise<TranscriptData> {
  try {
    // Extract video ID
    let videoId: string;
    if (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl)) {
      videoId = videoUrl;
    } else {
      const videoIdMatch = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (!videoIdMatch || !videoIdMatch[1]) {
        throw new Error(`Invalid YouTube URL or video ID: ${videoUrl}`);
      }
      videoId = videoIdMatch[1];
    }

    console.log(`Fetching transcript using library for video ID: ${videoId}`);

    // Fetch transcript using the library
    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: language,
      country: 'US'
    });

    if (!transcriptArray || transcriptArray.length === 0) {
      throw new Error('No transcript available for this video');
    }

    // Convert transcript array to single string
    const transcript = transcriptArray
      .map(entry => entry.text)
      .join(' ')
      .replace(/\[.*?\]/g, '') // Remove sound descriptions like [Music]
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (transcript.length < 10) {
      throw new Error('Transcript too short to be valid');
    }

    // Try to get video title (optional, requires additional API call or scraping)
    let title = '';
    try {
      const titleResponse = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (titleResponse.ok) {
        const titleData = await titleResponse.json();
        title = titleData.title || '';
      }
    } catch (titleError) {
      console.log('Could not fetch video title, proceeding without it');
    }

    console.log(`Successfully extracted transcript using library (${transcript.length} characters)`);

    return {
      transcript,
      language: transcriptArray[0]?.lang || language,
      videoId,
      title
    };

  } catch (error) {
    console.error('Library transcript extraction failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Transcript is disabled') || error.message.includes('not available')) {
        throw new Error('Transcript is not available for this video');
      } else if (error.message.includes('Video unavailable')) {
        throw new Error('Video is unavailable or private');
      } else if (error.message.includes('Invalid video')) {
        throw new Error('Invalid video ID or URL');
      }
    }
    
    throw new Error(`Failed to extract transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Updated transcript method with fallback chain
async getVideoTranscriptWithFallback(videoUrl: string, language: string = 'en'): Promise<TranscriptData> {
  console.log('Attempting transcript extraction with fallback chain...');
  
  // Method 1: Try library approach first (most reliable)
  try {
    console.log('Trying library method...');
    return await this.getVideoTranscriptLibrary(videoUrl, language);
  } catch (libraryError) {
    console.log(`Library method failed: ${libraryError instanceof Error ? libraryError.message : 'Unknown error'}`);
  }
  
  // Method 2: Fall back to improved scraping method
  try {
    console.log('Trying improved scraping method...');
    return await this.getVideoTranscript(videoUrl, language); // Your improved method from above
  } catch (scrapingError) {
    console.log(`Scraping method failed: ${scrapingError instanceof Error ? scrapingError.message : 'Unknown error'}`);
  }
  
  // If all methods fail
  throw new Error('All transcript extraction methods failed. Video may not have captions available or may be restricted.');
}
  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      await this.initialize();
      return this.browser !== null && this.browser.isConnected();
    } catch {
      return false;
    }
  }
}

// Export a singleton instance
export const googleScraperService = new GoogleScraperService();