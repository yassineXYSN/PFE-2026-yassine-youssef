import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

function getEnv(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const env = {}
    content.split('\n').forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) env[key.trim()] = value.trim()
    })
    return env
}

const env = getEnv('.env')
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkData() {
    console.log('--- Checking profiles ---')
    const p1 = await supabase.from('profiles').select('*').limit(1)
    console.log('profiles:', p1.status, p1.error ? p1.error.message : 'OK', p1.data?.length)

    console.log('--- Checking hr_profiles ---')
    const p2 = await supabase.from('hr_profiles').select('*').limit(1)
    console.log('hr_profiles:', p2.status, p2.error ? p2.error.message : 'OK', p2.data?.length)

    if (p2.data) {
        console.log('hr_profiles columns:', Object.keys(p2.data[0] || {}))
    }
}

checkData()
