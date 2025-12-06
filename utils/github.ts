// src/utils/github.ts

export const checkRepo = async (url: string) => {
  try {
    // 1. Bersihin URL biar dapet format "username/repo"
    // Contoh: https://github.com/Fannzxyl/kotoba-test.git -> Fannzxyl/kotoba-test
    const cleanUrl = url
      .replace('https://github.com/', '')
      .replace('.git', '')
      .replace(/\/$/, ''); // Hapus slash di akhir kalau ada

    // 2. Cek package.json (Buat deteksi React/Vue/Node)
    const apiUrl = `https://api.github.com/repos/${cleanUrl}/contents/package.json`;
    const response = await fetch(apiUrl);
    
    // SKENARIO A: Ada package.json (Project Modern)
    if (response.ok) {
        const data = await response.json();
        const content = atob(data.content); // Decode isi file dari Base64
        const pkg = JSON.parse(content);

        // Deteksi Framework
        let framework = 'Node.js';
        if (pkg.dependencies?.react || pkg.devDependencies?.react) framework = 'React';
        if (pkg.dependencies?.vue || pkg.devDependencies?.vue) framework = 'Vue';
        if (pkg.dependencies?.next) framework = 'Next.js';
        if (pkg.devDependencies?.vite) framework = 'Vite';
        if (pkg.dependencies?.['react-native']) framework = 'React Native (Web)';

        return {
            valid: true,
            name: pkg.name || cleanUrl.split('/')[1],
            framework,
            hasBuildScript: !!pkg.scripts?.build,
            mode: 'Node'
        };
    } 
    
    // SKENARIO B: Gak ada package.json (Mungkin HTML Biasa / Python / Lainnya)
    // Kita cek apakah reponya beneran ada (bukan 404)
    const repoCheck = await fetch(`https://api.github.com/repos/${cleanUrl}`);
    if (repoCheck.ok) {
        const repoData = await repoCheck.json();
        return {
            valid: true,
            name: repoData.name,
            framework: 'Static HTML / Other',
            hasBuildScript: false,
            mode: 'Static'
        };
    }

    // Kalau repo gak ketemu sama sekali
    throw new Error('Repository not found or private');

  } catch (error) {
    console.error(error);
    return { valid: false, error: 'Link GitHub tidak valid atau Repo Private.' };
  }
};