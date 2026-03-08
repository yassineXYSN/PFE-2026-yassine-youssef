import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

function getEnv(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const env = {}
    content.split('\n').forEach(line => {
        const parts = line.split('=')
        if (parts.length >= 2) {
            env[parts[0].trim()] = parts.slice(1).join('=').trim()
        }
    })
    return env
}

const env = getEnv('.env')
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function testFetch() {
    const testTables = ['profiles', 'hr_profiles', 'companies', 'hr_companies']
    for (const t of testTables) {
        console.log(`--- Testing ${t} ---`)
        const { data, error, status } = await supabase.from(t).select('*').limit(1)
        console.log(`Status: ${status} | Error: ${error ? error.message : 'None'} | Data count: ${data ? data.length : 'N/A'}`)
        if (data && data.length > 0) {
            console.log(`Sample columns: ${Object.keys(data[0]).join(', ')}`)
        }
    }
}

testFetch()
