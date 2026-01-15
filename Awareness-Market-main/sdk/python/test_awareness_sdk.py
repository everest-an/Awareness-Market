"""
Unit tests for Awareness Network Python SDK

Tests cover:
- Synchronous client operations
- Asynchronous client operations
- Streaming responses
- Batch operations
- Caching behavior
- Error handling
"""

import unittest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
import json

# Import SDK modules
from awareness_network_sdk import AwarenessClient
from awareness_network_async import AsyncAwarenessClient


class TestSynchronousClient(unittest.TestCase):
    """Test synchronous AwarenessClient"""
    
    def setUp(self):
        """Set up test client"""
        self.client = AwarenessClient(
            base_url="https://test.awareness-network.com",
            api_key="ak_test_1234567890abcdef1234567890abcdef"
        )
    
    @patch('requests.post')
    def test_register_ai_agent(self, mock_post):
        """Test AI agent registration"""
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "user_id": 123,
            "api_key": "ak_test_new_key",
            "agent_name": "TestAgent"
        }
        
        result = self.client.register_ai_agent(
            agent_name="TestAgent",
            agent_type="autonomous",
            capabilities=["nlp", "vision"]
        )
        
        self.assertEqual(result["user_id"], 123)
        self.assertEqual(result["agent_name"], "TestAgent")
        self.assertIn("api_key", result)
    
    @patch('requests.get')
    def test_discover_vectors(self, mock_get):
        """Test vector discovery"""
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "vectors": [
                {"id": 1, "title": "Sentiment Analysis", "category": "nlp"},
                {"id": 2, "title": "Named Entity Recognition", "category": "nlp"}
            ]
        }
        
        vectors = self.client.discover_vectors(category="nlp")
        
        self.assertEqual(len(vectors), 2)
        self.assertEqual(vectors[0]["title"], "Sentiment Analysis")
    
    @patch('requests.get')
    def test_get_vector(self, mock_get):
        """Test getting specific vector"""
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "id": 1,
            "title": "Sentiment Analysis",
            "base_price": "10.00",
            "average_rating": "4.5"
        }
        
        vector = self.client.get_vector(vector_id=1)
        
        self.assertEqual(vector["id"], 1)
        self.assertEqual(vector["title"], "Sentiment Analysis")
        self.assertEqual(vector["base_price"], "10.00")
    
    @patch('requests.post')
    def test_purchase_vector(self, mock_post):
        """Test vector purchase"""
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "transaction_id": "txn_123",
            "vector_id": 1,
            "status": "completed",
            "access_token": "access_token_xyz"
        }
        
        purchase = self.client.purchase_vector(vector_id=1)
        
        self.assertEqual(purchase["transaction_id"], "txn_123")
        self.assertEqual(purchase["status"], "completed")
        self.assertIn("access_token", purchase)
    
    @patch('requests.post')
    def test_invoke_vector(self, mock_post):
        """Test vector invocation"""
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "output": {"sentiment": "positive", "confidence": 0.95},
            "execution_time": 0.123
        }
        
        result = self.client.invoke_vector(
            vector_id=1,
            input_data={"text": "I love this product!"}
        )
        
        self.assertEqual(result["output"]["sentiment"], "positive")
        self.assertEqual(result["output"]["confidence"], 0.95)
    
    @patch('requests.get')
    def test_list_purchases(self, mock_get):
        """Test listing purchase history"""
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "purchases": [
                {"id": 1, "vector_id": 1, "status": "completed"},
                {"id": 2, "vector_id": 2, "status": "completed"}
            ]
        }
        
        purchases = self.client.list_purchases()
        
        self.assertEqual(len(purchases), 2)
        self.assertEqual(purchases[0]["vector_id"], 1)
    
    @patch('requests.put')
    def test_set_memory(self, mock_put):
        """Test setting AI memory"""
        mock_put.return_value.status_code = 200
        mock_put.return_value.json.return_value = {"success": True}
        
        result = self.client.set_memory("preferences", {"category": "nlp"})
        
        self.assertTrue(result["success"])
    
    @patch('requests.get')
    def test_get_memory(self, mock_get):
        """Test getting AI memory"""
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "key": "preferences",
            "value": {"category": "nlp"}
        }
        
        memory = self.client.get_memory("preferences")
        
        self.assertEqual(memory["value"]["category"], "nlp")
    
    @patch('requests.get')
    def test_caching(self, mock_get):
        """Test caching behavior"""
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "vectors": [{"id": 1, "title": "Test"}]
        }
        
        # First call should hit API
        vectors1 = self.client.discover_vectors()
        self.assertEqual(mock_get.call_count, 1)
        
        # Second call should use cache
        vectors2 = self.client.discover_vectors()
        self.assertEqual(mock_get.call_count, 1)  # Still 1
        
        # Results should be identical
        self.assertEqual(vectors1, vectors2)
    
    def test_clear_cache(self):
        """Test cache clearing"""
        self.client.clear_cache()
        # Should not raise any errors
        self.assertTrue(True)


class TestAsynchronousClient(unittest.TestCase):
    """Test asynchronous AsyncAwarenessClient"""
    
    def setUp(self):
        """Set up test client"""
        self.client = AsyncAwarenessClient(
            base_url="https://test.awareness-network.com",
            api_key="ak_test_1234567890abcdef1234567890abcdef"
        )
    
    @patch('aiohttp.ClientSession.post')
    def test_async_register(self, mock_post):
        """Test async AI agent registration"""
        async def run_test():
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "user_id": 123,
                "api_key": "ak_test_new_key"
            })
            mock_post.return_value.__aenter__.return_value = mock_response
            
            result = await self.client.register_ai_agent(
                agent_name="AsyncAgent",
                agent_type="autonomous"
            )
            
            self.assertEqual(result["user_id"], 123)
        
        asyncio.run(run_test())
    
    @patch('aiohttp.ClientSession.get')
    def test_async_discover_vectors(self, mock_get):
        """Test async vector discovery"""
        async def run_test():
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "vectors": [
                    {"id": 1, "title": "Test Vector"}
                ]
            })
            mock_get.return_value.__aenter__.return_value = mock_response
            
            vectors = await self.client.discover_vectors()
            
            self.assertEqual(len(vectors), 1)
        
        asyncio.run(run_test())
    
    @patch('aiohttp.ClientSession.post')
    def test_async_purchase(self, mock_post):
        """Test async vector purchase"""
        async def run_test():
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "transaction_id": "txn_async_123",
                "status": "completed"
            })
            mock_post.return_value.__aenter__.return_value = mock_response
            
            purchase = await self.client.purchase_vector(vector_id=1)
            
            self.assertEqual(purchase["transaction_id"], "txn_async_123")
        
        asyncio.run(run_test())
    
    @patch('aiohttp.ClientSession.post')
    def test_async_invoke(self, mock_post):
        """Test async vector invocation"""
        async def run_test():
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "output": {"result": "success"}
            })
            mock_post.return_value.__aenter__.return_value = mock_response
            
            result = await self.client.invoke_vector(
                vector_id=1,
                input_data={"text": "test"}
            )
            
            self.assertEqual(result["output"]["result"], "success")
        
        asyncio.run(run_test())
    
    def test_async_close(self):
        """Test async client cleanup"""
        async def run_test():
            await self.client.close()
            # Should not raise any errors
            self.assertTrue(True)
        
        asyncio.run(run_test())


class TestStreamingOperations(unittest.TestCase):
    """Test streaming responses"""
    
    def setUp(self):
        """Set up async client for streaming"""
        self.client = AsyncAwarenessClient(
            base_url="https://test.awareness-network.com",
            api_key="ak_test_1234567890abcdef1234567890abcdef"
        )
    
    @patch('aiohttp.ClientSession.get')
    def test_stream_invoke(self, mock_get):
        """Test streaming vector invocation"""
        async def run_test():
            # Mock SSE stream
            mock_response = AsyncMock()
            mock_response.status = 200
            
            async def mock_content():
                events = [
                    b'event: connected\ndata: {"status":"connected"}\n\n',
                    b'event: progress\ndata: {"progress":0.5}\n\n',
                    b'event: data\ndata: {"text":"Partial result"}\n\n',
                    b'event: done\ndata: {"status":"complete"}\n\n'
                ]
                for event in events:
                    yield event
            
            mock_response.content.iter_any = mock_content
            mock_get.return_value.__aenter__.return_value = mock_response
            
            chunks = []
            async for chunk in self.client.invoke_vector_stream(
                vector_id=1,
                input_data={"text": "test"}
            ):
                chunks.append(chunk)
            
            self.assertEqual(len(chunks), 4)
            self.assertEqual(chunks[0]["event"], "connected")
            self.assertEqual(chunks[1]["event"], "progress")
            self.assertEqual(chunks[2]["event"], "data")
            self.assertEqual(chunks[3]["event"], "done")
        
        asyncio.run(run_test())


class TestBatchOperations(unittest.TestCase):
    """Test batch processing"""
    
    def setUp(self):
        """Set up clients"""
        self.sync_client = AwarenessClient(
            base_url="https://test.awareness-network.com",
            api_key="ak_test_1234567890abcdef1234567890abcdef"
        )
        self.async_client = AsyncAwarenessClient(
            base_url="https://test.awareness-network.com",
            api_key="ak_test_1234567890abcdef1234567890abcdef"
        )
    
    @patch('requests.post')
    def test_sync_batch_invoke(self, mock_post):
        """Test synchronous batch invocation"""
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "results": [
                {"vector_id": 1, "success": True, "result": {"output": "result1"}},
                {"vector_id": 1, "success": True, "result": {"output": "result2"}},
                {"vector_id": 2, "success": False, "error": "Not found"}
            ]
        }
        
        requests = [
            {"vector_id": 1, "input": {"text": "item1"}},
            {"vector_id": 1, "input": {"text": "item2"}},
            {"vector_id": 2, "input": {"text": "item3"}}
        ]
        
        results = self.sync_client.batch_invoke(requests)
        
        self.assertEqual(len(results), 3)
        self.assertTrue(results[0]["success"])
        self.assertTrue(results[1]["success"])
        self.assertFalse(results[2]["success"])
    
    @patch('aiohttp.ClientSession.post')
    def test_async_batch_invoke(self, mock_post):
        """Test asynchronous batch invocation"""
        async def run_test():
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "results": [
                    {"vector_id": 1, "success": True, "result": {"output": "async_result"}}
                ]
            })
            mock_post.return_value.__aenter__.return_value = mock_response
            
            requests = [
                {"vector_id": 1, "input": {"text": "test"}}
            ]
            
            results = await self.async_client.batch_invoke(requests)
            
            self.assertEqual(len(results), 1)
            self.assertTrue(results[0]["success"])
        
        asyncio.run(run_test())


class TestErrorHandling(unittest.TestCase):
    """Test error handling"""
    
    def setUp(self):
        """Set up test client"""
        self.client = AwarenessClient(
            base_url="https://test.awareness-network.com",
            api_key="ak_test_1234567890abcdef1234567890abcdef"
        )
    
    @patch('requests.get')
    def test_404_error(self, mock_get):
        """Test 404 Not Found error"""
        mock_get.return_value.status_code = 404
        mock_get.return_value.json.return_value = {"error": "Vector not found"}
        
        with self.assertRaises(Exception) as context:
            self.client.get_vector(vector_id=999)
        
        self.assertIn("404", str(context.exception))
    
    @patch('requests.post')
    def test_401_error(self, mock_post):
        """Test 401 Unauthorized error"""
        mock_post.return_value.status_code = 401
        mock_post.return_value.json.return_value = {"error": "Invalid API key"}
        
        with self.assertRaises(Exception) as context:
            self.client.purchase_vector(vector_id=1)
        
        self.assertIn("401", str(context.exception))
    
    @patch('requests.post')
    def test_429_rate_limit(self, mock_post):
        """Test 429 Rate Limit error"""
        mock_post.return_value.status_code = 429
        mock_post.return_value.headers = {"Retry-After": "60"}
        mock_post.return_value.json.return_value = {"error": "Rate limit exceeded"}
        
        with self.assertRaises(Exception) as context:
            self.client.invoke_vector(vector_id=1, input_data={})
        
        self.assertIn("429", str(context.exception))


class TestLatentMASOperations(unittest.TestCase):
    """Test LatentMAS protocol operations"""
    
    def setUp(self):
        """Set up test client"""
        self.client = AwarenessClient(
            base_url="https://test.awareness-network.com",
            api_key="ak_test_1234567890abcdef1234567890abcdef"
        )
    
    @patch('requests.post')
    def test_align_vector(self, mock_post):
        """Test vector alignment"""
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "aligned_vector": [0.1, 0.2, 0.3],
            "alignment_quality": {"confidence": 0.85}
        }
        
        result = self.client.align_vector(
            source_vector=[0.1, 0.2, 0.3],
            source_model="gpt-4",
            target_model="bert"
        )
        
        self.assertEqual(len(result["aligned_vector"]), 3)
        self.assertEqual(result["alignment_quality"]["confidence"], 0.85)
    
    @patch('requests.post')
    def test_transform_vector(self, mock_post):
        """Test vector dimension transformation"""
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "transformed_vector": [0.1, 0.2],
            "information_retention": 0.92
        }
        
        result = self.client.transform_vector(
            vector=[0.1, 0.2, 0.3, 0.4],
            source_dim=4,
            target_dim=2,
            method="pca"
        )
        
        self.assertEqual(len(result["transformed_vector"]), 2)
        self.assertEqual(result["information_retention"], 0.92)


if __name__ == '__main__':
    unittest.main()
