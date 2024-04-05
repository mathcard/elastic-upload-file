import express from 'express';
import { Request, Response } from 'express';
import axios, { AxiosInstance } from 'axios';
import multer from 'multer';
import fs from 'fs';
import https from 'https';
import mime from 'mime-types'; 
import path from 'path';
require('dotenv').config();

const app = express();
const port = 3000;

const username = process.env.ELASTICSEARCH_USERNAME;
const password = process.env.ELASTICSEARCH_PASSWORD;
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads'); // Destination folder for uploaded files
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Use original filename
    }
});

const upload = multer({ storage: storage });

// Set up Elasticsearch client
const elasticsearchClient = axios.create({
    baseURL: 'https://elasticsearch.sistemafaeg.org.br:9200', // Adjust URL as needed
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`        
    },
    httpsAgent: new https.Agent({ rejectUnauthorized: false }) as any
});

app.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;        
        const data = await readFileBase64(filePath);
        const indexName = 'meetup'; // Adjust index name as needed
        const documentId = await indexData(data, indexName);        
        res.status(200).json({ message: 'File uploaded and indexed successfully', documentId });

    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route to handle file retrieval by ID
app.get('/file/:id', async (req: Request, res: Response) => {
    try {
        const fileId = req.params.id;        
        const indexName = 'meetup'; 
        const fileData = await getFileData(fileId, indexName);        
        const filePath = path.join(__dirname, `${fileId}.txt`);
        fs.writeFileSync(filePath, fileData);            
        res.status(200).json({ message: `File data exported to ${fileId}.txt` });
    } catch (error) {
        console.error('Error retrieving file:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});




// Function to retrieve file data from Elasticsearch by ID
async function getFileData(fileId: string, indexName: string): Promise<string> {
    try {
        const url = `/${indexName}/_doc/${fileId}`;
        const response = await elasticsearchClient.get(url);
        console.log(response.data._source.content.slice(0, 50))
        return response.data._source.content; // Assuming 'content' field stores base64-encoded file content
    } catch (error: any) {
        console.error('Error retrieving file data:', error.response?.status, error.response?.data);                
        throw error;
    }
}








// Function to read file data
async function readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

// Function to read file data and encode as base64
async function readFileBase64(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                reject(err);
            } else {                
                  const mimeType = mime.lookup(filePath) || 'application/octet-stream';
                  // Construct data URI with MIME type and base64-encoded data
                  const dataUri = `data:${mimeType};base64,${Buffer.from(data).toString('base64')}`;
                  resolve(dataUri);
            }
        });
    });
}


async function indexData(data: string, indexName: string): Promise<void> {
    try {
        const url = `/${indexName}/_doc`; // Adjust index name as needed
        const payload = { content: data }; // Assuming 'content' field is used to store base64 encoded file
        const response = await elasticsearchClient.post(url, payload);
        //await elasticsearchClient.post(url, data);
        const documentId = response.data._id; // Extract document ID from the response
        console.log('Data indexed successfully with ID:', documentId);
        console.log('Data indexed successfully');
        return documentId;        
    } catch (error: any) {
        if (error.response) {
            console.error('Error indexing data:',  (error.response as any).status, (error.response as any).data);
        } else {
            console.error('Error indexing data:', (error as Error).message);

        }
        throw error;
    }
}

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
