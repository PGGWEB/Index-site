import React, { useState } from "react";
import axios from "axios";
import { parseStringPromise } from "xml2js";

function App() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [indexablePages, setIndexablePages] = useState([]);
  const [robotsTxt, setRobotsTxt] = useState("");
  const [sitemapXml, setSitemapXml] = useState("");
  const [error, setError] = useState(null);

  const handleScanSite = async () => {
    if (!domain) {
      alert("Vă rugăm să introduceți un domeniu valid.");
      return;
    }

    setLoading(true);
    setError(null);
    setIndexablePages([]);
    setRobotsTxt("");
    setSitemapXml("");

    const domainUrl = domain.startsWith("http") ? domain : `https://${domain}`;
    const domainOrigin = new URL(domainUrl).origin;

    try {
      // Preluăm robots.txt
      const robotsTxtUrl = `${domainOrigin}/robots.txt`;
      const robotsResponse = await axios.get(
        `https://api.allorigins.win/get?url=${encodeURIComponent(robotsTxtUrl)}`
      );
      const robotsTxtContent = robotsResponse.data.contents;
      setRobotsTxt(robotsTxtContent);

      // Extragem URL-urile sitemap din robots.txt
      let sitemapUrls = [];
      const robotsLines = robotsTxtContent.split("\n");
      robotsLines.forEach((line) => {
        const match = line.match(/^\s*Sitemap:\s*(.*)$/i);
        if (match) {
          const sitemapUrl = match[1].trim();
          sitemapUrls.push(sitemapUrl);
        }
      });

      // Dacă nu găsim sitemap-uri în robots.txt, încercăm /sitemap.xml
      if (sitemapUrls.length === 0) {
        const sitemapUrl = `${domainOrigin}/sitemap.xml`;
        sitemapUrls.push(sitemapUrl);
      }

      // Preluăm și parsăm sitemap-urile recursiv
      let allSitemapUrls = [...sitemapUrls];
      let allUrls = [];

      const fetchSitemap = async (sitemapUrl) => {
        try {
          const sitemapResponse = await axios.get(
            `https://api.allorigins.win/get?url=${encodeURIComponent(
              sitemapUrl
            )}`
          );
          const sitemapData = sitemapResponse.data.contents;

          // Adăugăm conținutul sitemap-ului la starea sitemapXml
          setSitemapXml((prev) => prev + "\n" + sitemapData);

          const result = await parseStringPromise(sitemapData);

          if (result.urlset && result.urlset.url) {
            // Acesta este un sitemap cu URL-uri
            result.urlset.url.forEach((urlObj) => {
              if (urlObj.loc && urlObj.loc[0]) {
                allUrls.push(urlObj.loc[0]);
              }
            });
          } else if (result.sitemapindex && result.sitemapindex.sitemap) {
            // Acesta este un sitemap index
            for (const sitemapObj of result.sitemapindex.sitemap) {
              if (sitemapObj.loc && sitemapObj.loc[0]) {
                const childSitemapUrl = sitemapObj.loc[0];
                if (!allSitemapUrls.includes(childSitemapUrl)) {
                  allSitemapUrls.push(childSitemapUrl);
                  await fetchSitemap(childSitemapUrl);
                }
              }
            }
          }
        } catch (error) {
          console.error(
            `Eroare la preluarea sitemap-ului ${sitemapUrl}:`,
            error
          );
        }
      };

      for (const sitemapUrl of sitemapUrls) {
        await fetchSitemap(sitemapUrl);
      }

      // Eliminăm duplicatele
      allUrls = [...new Set(allUrls)];

      // Actualizăm paginile indexabile
      setIndexablePages(allUrls);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("A apărut o eroare. Verificați consola pentru detalii.");
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Verificare Indexare Site</h1>
      <input
        type="text"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        placeholder="Introduceți domeniul (ex: exemplu.ro)"
      />
      <button onClick={handleScanSite} disabled={loading}>
        {loading ? "Se încarcă..." : "Verifică Site-ul"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {robotsTxt && (
        <div className="results">
          <h2>robots.txt:</h2>
          <pre>{robotsTxt}</pre>
        </div>
      )}
      {sitemapXml && (
        <div className="results">
          <h2>sitemap.xml:</h2>
          <pre>{sitemapXml}</pre>
        </div>
      )}
      {indexablePages.length > 0 && (
        <div className="results">
          <h2>Total pagini găsite: {indexablePages.length}</h2>
          <h2>URL-uri din sitemap:</h2>
          {indexablePages.map((link, index) => (
            <div key={index} className="result-item">
              {link}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
