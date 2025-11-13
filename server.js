const http = require('https');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// API endpoint for word definition
app.post('/api/define', async (req, res) => {
    const { word } = req.body;

    if (!word) {
        return res.status(400).json({ error: 'Word is required' });
    }

    const prompt = `Give me a simple A1 Elementary level English definition for the word "${word}" and provide exactly 3 simple, easy-to-understand example sentences using this word. 

If the word "${word}" is misspelled or does not exist, find the correct spelling and provide the definition for the correct word. Start your response with "Did you mean: [correct word]?" if you corrected the spelling.

Format your response EXACTLY like this:
Definition: [simple definition here]
Examples:
1. [first example]
2. [second example]
3. [third example]`;

    const options = {
        method: 'POST',
        hostname: 'deepseek-v31.p.rapidapi.com',
        port: null,
        path: '/',
        headers: {
            'x-rapidapi-key': '802a4c78efmshdd1d23d408b26a7p1b63bcjsn09fefdffa5fe',
            'x-rapidapi-host': 'deepseek-v31.p.rapidapi.com',
            'Content-Type': 'application/json'
        }
    };

    const apiRequest = http.request(options, function (apiResponse) {
        const chunks = [];

        apiResponse.on('data', function (chunk) {
            chunks.push(chunk);
        });

        apiResponse.on('end', function () {
            try {
                const body = Buffer.concat(chunks);
                const response = JSON.parse(body.toString());

                if (response.choices && response.choices[0]) {
                    const content = response.choices[0].message.content;
                    const parsed = parseResponse(content);
                    res.json(parsed);
                } else {
                    res.status(500).json({ error: 'Invalid response from API' });
                }
            } catch (error) {
                console.error('Error parsing response:', error);
                res.status(500).json({ error: 'Failed to process definition' });
            }
        });
    });

    apiRequest.on('error', (error) => {
        console.error('API request error:', error);
        res.status(500).json({ error: 'Failed to fetch definition' });
    });

    apiRequest.write(JSON.stringify({
        model: 'DeepSeek-V3-0324',
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ]
    }));

    apiRequest.end();
});

// Helper function to parse the AI response
function parseResponse(content) {
    try {
        // Check if AI corrected the spelling
        let correctedWord = null;
        const correctionMatch = content.match(/Did you mean:?\s*["\']?([a-zA-Z]+)["\']?/i);
        if (correctionMatch) {
            correctedWord = correctionMatch[1];
        }

        // Extract definition
        const defMatch = content.match(/Definition:\s*(.+?)(?=Examples:|$)/is);
        const definition = defMatch ? defMatch[1].trim() : '';

        // Extract examples
        const examplesMatch = content.match(/Examples:\s*([\s\S]+)/i);
        let examples = [];

        if (examplesMatch) {
            const examplesText = examplesMatch[1];
            // Match numbered examples (1. , 2. , 3. )
            const exampleMatches = examplesText.match(/\d+\.\s*(.+?)(?=\d+\.|$)/gs);
            if (exampleMatches) {
                examples = exampleMatches.map(ex => 
                    ex.replace(/^\d+\.\s*/, '').trim()
                ).filter(ex => ex.length > 0).slice(0, 3);
            }
        }

        // Ensure we have exactly 3 examples
        while (examples.length < 3) {
            examples.push('Example not available.');
        }

        const result = {
            definition: definition || 'Definition not found.',
            examples: examples.slice(0, 3)
        };

        // Add corrected word if spelling was fixed
        if (correctedWord) {
            result.correctedWord = correctedWord;
        }

        return result;
    } catch (error) {
        console.error('Error parsing content:', error);
        return {
            definition: 'Error parsing definition.',
            examples: ['Example 1', 'Example 2', 'Example 3']
        };
    }
}

app.listen(PORT, () => {
    console.log(`Dictionary server is running on http://localhost:${PORT}`);
    console.log(`Open your browser and go to http://localhost:${PORT}`);
});
