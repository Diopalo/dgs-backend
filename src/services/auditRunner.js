const { spawn } = require('child_process');
const path = require('path');

// Sous Windows, "python" fonctionne si Python est dans le PATH.
// Sinon, définis PYTHON_EXECUTABLE=py (ou le chemin complet) dans .env
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python';
const SCRIPT_PATH = path.join(__dirname, '..', 'crawler', 'audit.py');

function runPythonAudit(url) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_EXECUTABLE, [SCRIPT_PATH, url]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', () => {
      if (!stdout.trim()) {
        return reject(new Error(stderr || 'Le script Python n\'a renvoyé aucune sortie.'));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`Réponse Python invalide : ${stdout}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

/**
 * RG-05 : un crawl en échec est relancé une fois, puis marqué en échec.
 */
async function runAuditWithRetry(url) {
  try {
    const result = await runPythonAudit(url);
    if (result.statut === 'echec') {
      throw new Error(result.erreur || 'Échec du crawl.');
    }
    return result;
  } catch (firstError) {
    const retryResult = await runPythonAudit(url);
    if (retryResult.statut === 'echec') {
      throw new Error(`${retryResult.erreur || 'Échec du crawl'} (après une relance)`);
    }
    return retryResult;
  }
}

module.exports = { runAuditWithRetry };
