const { exec } = require('child_process');

const PORT = 3001;

console.log(`Checking for processes on port ${PORT}...`);

exec(`lsof -i :${PORT} -t`, (error, stdout, stderr) => {
    if (error) {
        if (error.code === 1) {
            console.log(`No process found using port ${PORT}.`);
        } else {
            console.error(`Error checking port ${PORT}:`, error.message);
        }
        return;
    }

    const pids = stdout.trim().split('\n');
    if (pids.length > 0) {
        console.log(`Found process(es) on port ${PORT}: ${pids.join(', ')}`);
        console.log('Killing process(es)...');

        pids.forEach(pid => {
            exec(`kill -9 ${pid}`, (killError, killStdout, killStderr) => {
                if (killError) {
                    console.error(`Failed to kill process ${pid}:`, killError.message);
                } else {
                    console.log(`Successfully killed process ${pid}.`);
                }
            });
        });
    }
});
