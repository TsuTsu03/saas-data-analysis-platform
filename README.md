1. Schema Reasoning
I kept the schema simple but flexible. I used one main table in Supabase to store both the raw data and the analysis results so everything stays in sync and easy to query. It’s also easier to scale later if I decide to separate them into different tables or add relationships like user ratings or logs.

2. Workflow Explanation
The flow starts when Apify collects data from a public source and sends it to Supabase. From there, each record gets analyzed through the OpenAI API, which adds sentiment and confidence data back into the database. The frontend then pulls everything and shows it in a clean dashboard where I can filter, sort, and rate each record.

3. Scaling Thought
If I had to handle something like 100,000 records a day, I’d definitely use batching and async processing to spread the workload. I’d probably add a queue system or background worker to process the data in chunks instead of all at once. I’d also add indexes and caching to keep the app responsive even with larger datasets.

4. Failure Handling
For API errors or rate limits, I’d add retries with short delays and log everything that fails. If something keeps failing, I’d tag those records for reprocessing later instead of losing them. That way, the system stays stable and I can easily track what went wrong.

5. System Health View
The System Health page gives a quick overview of how things are running — total records, analyzed count, confidence, and the last time OpenAI was called. It’s useful to see right away if the analysis pipeline is healthy or if something stopped working. Basically, it acts like a mini status dashboard for monitoring uptime and progress.# saas-data-analysis-platform
