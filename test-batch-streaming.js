// Test script for the new parallel batch streaming system
// Run with: node test-batch-streaming.js

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:3000';

// Test essays with intentional errors for grading
const testEssays = [
  {
    studentName: "Alice Johnson",
    studentText: "Yesterday i go to the store with my friend. We buyed many thing for the party. The weather was very nice and we have good time. My friend tall me about her new job which sound interesting."
  },
  {
    studentName: "Bob Smith",
    studentText: "Last wekend I visit my grandparents house. They live in countryside where is very peaceful. We eat delicious food and talk about old times. I really enjoy spend time with them."
  },
  {
    studentName: "Charlie Brown",
    studentText: "Today morning I wake up late for school. I quick get dressed and run to catch the bus. Fortunately i make it on time. The teacher dont notice I was almost late."
  },
  {
    studentName: "Diana Prince",
    studentText: "My favorite hobby are reading books. I can read for hour without get bored. Books take me to different world and teach me many thing. Reading help me improve my english too."
  },
  {
    studentName: "Edward Norton",
    studentText: "The movie we watch yesterday was very excited. All the actors play their role perfect. The story keep me on edge of my seat. I definately recommend it to anyone who like action films."
  },
  {
    studentName: "Fiona Green",
    studentText: "Cooking is something I learn recently. At first it seem difficult but now I enjoy make different dishes. My family say my food taste good which make me happy. I want learn more recipes."
  }
];

async function testBatchStreaming() {
  console.log('🚀 Testing Parallel Batch Streaming System');
  console.log(`📝 Sending ${testEssays.length} essays for grading...`);
  console.log('-------------------------------------------\n');

  try {
    const response = await fetch(`${API_URL}/api/grade-batch?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        essays: testEssays,
        prompt: "Write about a recent experience",
        classProfile: "default", // Adjust this to match your profile
        temperature: 0
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Process the stream
    const reader = response.body;
    let buffer = '';
    let resultCount = 0;
    const startTime = Date.now();
    const resultTimes = [];

    for await (const chunk of reader) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

            switch (data.type) {
              case 'start':
                console.log(`[${elapsed}s] ✅ Streaming started`);
                break;

              case 'processing':
                console.log(`[${elapsed}s] 🔄 Processing ${data.studentName} (index: ${data.index})`);
                break;

              case 'result':
                resultCount++;
                resultTimes.push(elapsed);
                const status = data.success ? '✅' : '❌';
                console.log(`[${elapsed}s] ${status} Result #${resultCount} received: ${data.studentName} (index: ${data.index})`);
                if (data.success && data.result?.total) {
                  console.log(`    Score: ${data.result.total.points}/${data.result.total.out_of}`);
                } else if (!data.success) {
                  console.log(`    Error: ${data.error}`);
                }
                break;

              case 'complete':
                console.log(`[${elapsed}s] 🎉 All essays completed!\n`);
                break;

              case 'error':
                console.log(`[${elapsed}s] ❌ Error: ${data.error}`);
                break;
            }
          } catch (e) {
            console.error('Error parsing data:', e, line);
          }
        }
      }
    }

    // Calculate timing statistics
    console.log('\n📊 Timing Analysis:');
    console.log('-------------------------------------------');
    if (resultTimes.length > 1) {
      for (let i = 1; i < resultTimes.length; i++) {
        const delay = (parseFloat(resultTimes[i]) - parseFloat(resultTimes[i-1])).toFixed(2);
        console.log(`Delay between result ${i} and ${i+1}: ${delay}s`);
      }
    }
    console.log(`Total time: ${resultTimes[resultTimes.length - 1]}s`);
    console.log(`Average time per essay: ${(parseFloat(resultTimes[resultTimes.length - 1]) / testEssays.length).toFixed(2)}s`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
console.log('Starting test in 2 seconds...\n');
setTimeout(testBatchStreaming, 2000);