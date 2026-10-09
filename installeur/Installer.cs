// Installe ou met à jour le mod "conso" pour Claude (onglet Code) et l'active pour toutes les discussions.
// Il télécharge la dernière version depuis GitHub (ou utilise celle qu'il embarque s'il est hors ligne),
// copie un dossier et ajoute une ligne à settings.json. Rien d'autre.
//
// Compiler (Windows, .NET Framework 4, déjà présent) : voir installeur/compiler.cmd.
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

static class Installer
{
    const string Title = "Mod Conso pour Claude";
    const string Key = "CLAUDE_CODE_PLUGIN_DIRS";
    // L'archive de la branche principale : chaque version publiée y est disponible aussitôt.
    const string Latest = "https://github.com/GetPiraa/claude-conso/archive/refs/heads/main.zip";
    const string Manifest = "conso/.claude-plugin/plugin.json";

    static string VersionIn(string manifest)
    {
        try
        {
            Dictionary<string, object> read = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(manifest);
            return read.ContainsKey("version") ? Convert.ToString(read["version"]) : "0.0.0";
        }
        catch
        {
            return "0.0.0";
        }
    }

    static int Compare(string a, string b)
    {
        Version left, right;
        if (Version.TryParse(a, out left) && Version.TryParse(b, out right)) return left.CompareTo(right);
        return string.CompareOrdinal(a, b);
    }

    static string Slashed(string name)
    {
        return name.Replace('\\', '/');
    }

    // Dans l'archive, le mod est sous "conso/" (version embarquée) ou sous "<dépôt>-main/conso/" (archive GitHub).
    static string PrefixOf(ZipArchive archive)
    {
        ZipArchiveEntry manifest = archive.Entries.FirstOrDefault(e => Slashed(e.FullName).EndsWith(Manifest));
        if (manifest == null) return null;
        string name = Slashed(manifest.FullName);
        return name.Substring(0, name.Length - ".claude-plugin/plugin.json".Length);
    }

    static string VersionOf(byte[] zip)
    {
        using (ZipArchive archive = new ZipArchive(new MemoryStream(zip), ZipArchiveMode.Read))
        {
            string prefix = PrefixOf(archive);
            if (prefix == null) return null;
            ZipArchiveEntry manifest = archive.Entries.First(e => Slashed(e.FullName) == prefix + ".claude-plugin/plugin.json");
            using (StreamReader reader = new StreamReader(manifest.Open())) return VersionIn(reader.ReadToEnd());
        }
    }

    static byte[] Embedded()
    {
        using (Stream zip = Assembly.GetExecutingAssembly().GetManifestResourceStream("conso.zip"))
        using (MemoryStream copy = new MemoryStream())
        {
            zip.CopyTo(copy);
            return copy.ToArray();
        }
    }

    // La dernière version en ligne, ou null si elle est injoignable ou illisible.
    static byte[] Online()
    {
        try
        {
            string source = Environment.GetEnvironmentVariable("CONSO_SOURCE") ?? Latest;
            if (source == "aucune") return null;
            byte[] zip;
            if (File.Exists(source))
            {
                zip = File.ReadAllBytes(source);
            }
            else
            {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(source);
                request.Timeout = 15000;
                request.ReadWriteTimeout = 15000;
                request.UserAgent = "conso-installeur";
                using (WebResponse response = request.GetResponse())
                using (Stream body = response.GetResponseStream())
                using (MemoryStream copy = new MemoryStream())
                {
                    body.CopyTo(copy);
                    zip = copy.ToArray();
                }
            }
            return VersionOf(zip) == null ? null : zip;
        }
        catch
        {
            return null;
        }
    }

    static void Extract(byte[] zip, string target)
    {
        using (ZipArchive archive = new ZipArchive(new MemoryStream(zip), ZipArchiveMode.Read))
        {
            string prefix = PrefixOf(archive);
            foreach (ZipArchiveEntry entry in archive.Entries)
            {
                string name = Slashed(entry.FullName);
                // Seul le mod est copié : ni le reste du dépôt, ni ses tests.
                if (!name.StartsWith(prefix) || name.EndsWith("/") || name.StartsWith(prefix + "tests/")) continue;
                string path = Path.GetFullPath(Path.Combine(target, name.Substring(prefix.Length)));
                if (!path.StartsWith(target, StringComparison.OrdinalIgnoreCase)) continue;
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                entry.ExtractToFile(path, true);
            }
        }
    }

    [STAThread]
    static int Main()
    {
        bool silent = Environment.GetEnvironmentVariable("CONSO_SILENT") != null;
        string home = Environment.GetEnvironmentVariable("USERPROFILE");
        string claude = Path.Combine(home, ".claude");
        string target = Path.Combine(claude, "mods", "conso");
        string settingsPath = Path.Combine(claude, "settings.json");
        try
        {
            // La version la plus récente entre celle en ligne et celle embarquée.
            byte[] embedded = Embedded();
            byte[] online = Online();
            bool fromWeb = online != null && Compare(VersionOf(online), VersionOf(embedded)) >= 0;
            byte[] chosen = fromWeb ? online : embedded;
            string shipped = VersionOf(chosen);
            string origin = fromWeb ? "téléchargée depuis GitHub" : online == null ? "embarquée dans l'installeur (GitHub injoignable)" : "embarquée dans l'installeur";

            // Déjà installé ? L'installeur devient une mise à jour : il remplace les fichiers du mod, rien d'autre.
            string manifest = Path.Combine(target, ".claude-plugin", "plugin.json");
            string installed = File.Exists(manifest) ? VersionIn(File.ReadAllText(manifest)) : null;
            bool isUpdate = installed != null;
            if (!silent)
            {
                string ask;
                if (!isUpdate)
                {
                    ask = "Installer le mod Conso pour Claude ?\n\nVersion " + shipped + ", " + origin + ".\n\n"
                        + "1. Le mod est copié dans :\n" + target + "\n\n"
                        + "2. Une ligne est ajoutée à :\n" + settingsPath + "\n(l'ancien fichier est gardé en .avant-conso.bak)";
                }
                else
                {
                    int order = Compare(installed, shipped);
                    if (order == 0)
                    {
                        MessageBox.Show("Le mod Conso est déjà à jour (version " + shipped + ").", Title, MessageBoxButtons.OK, MessageBoxIcon.Information);
                        return 0;
                    }
                    string head = order < 0 ? "Mettre à jour le mod Conso : version " + installed + " → " + shipped + " ?"
                        : "Attention : la version installée (" + installed + ") est plus récente que la version disponible (" + shipped + "). La remplacer quand même ?";
                    ask = head + "\n\nNouvelle version " + origin + ".\n\nLes fichiers du mod sont remplacés dans :\n" + target
                        + "\n\nTes chiffres, ton historique et les limites déjà apprises sont conservés.";
                }
                if (MessageBox.Show(ask, Title, MessageBoxButtons.OKCancel, isUpdate ? MessageBoxIcon.Information : MessageBoxIcon.Question) != DialogResult.OK) return 1;
            }

            // 1. Le dossier du mod : l'ancien est retiré en entier, le nouveau prend sa place.
            if (Directory.Exists(target)) Directory.Delete(target, true);
            Directory.CreateDirectory(target);
            Extract(chosen, target);
            if (!File.Exists(manifest)) throw new Exception("La copie du mod est incomplète.");

            // 2. Le réglage qui le charge dans chaque discussion.
            JavaScriptSerializer json = new JavaScriptSerializer();
            Dictionary<string, object> settings = new Dictionary<string, object>();
            if (File.Exists(settingsPath))
            {
                string raw = File.ReadAllText(settingsPath);
                string backup = settingsPath + ".avant-conso.bak";
                if (!File.Exists(backup)) File.Copy(settingsPath, backup);
                if (raw.Trim().Length > 0) settings = json.Deserialize<Dictionary<string, object>>(raw);
            }
            Dictionary<string, object> env = settings.ContainsKey("env") ? settings["env"] as Dictionary<string, object> : null;
            if (env == null) env = new Dictionary<string, object>();
            string current = env.ContainsKey(Key) ? Convert.ToString(env[Key]) : "";
            List<string> dirs = current.Split(';').Where(d => d.Length > 0 && !d.Equals(target, StringComparison.OrdinalIgnoreCase)).ToList();
            dirs.Add(target);
            string wanted = string.Join(";", dirs);
            if (wanted != current)
            {
                env[Key] = wanted;
                settings["env"] = env;
                File.WriteAllText(settingsPath, json.Serialize(settings) + "\n", new UTF8Encoding(false));
            }

            if (!silent)
            {
                bool hasNode = (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';')
                    .Any(dir => dir.Length > 0 && File.Exists(Path.Combine(dir.Trim('"'), "node.exe")));
                string done = isUpdate
                    ? "Mise à jour terminée : version " + shipped + ".\n\nFerme complètement Claude puis relance-le. Dans une discussion neuve, la commande /conso-actualiser fait apparaître la bande dans les discussions déjà ouvertes."
                    : "Installation terminée : version " + shipped + ".\n\nFerme complètement Claude puis relance-le : la bande de conso apparaît au-dessus de la zone de saisie, et /conso ouvre le détail.\n\nPour mettre à jour plus tard, relance simplement cet installeur.";
                if (!hasNode) done += "\n\nAttention : Node.js est introuvable. Le mod en a besoin pour compter les tokens. Installe-le depuis https://nodejs.org puis relance Claude.";
                MessageBox.Show(done, Title, MessageBoxButtons.OK, hasNode ? MessageBoxIcon.Information : MessageBoxIcon.Warning);
            }
            return 0;
        }
        catch (Exception error)
        {
            if (!silent) MessageBox.Show("L'installation a échoué :\n" + error.Message, Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 2;
        }
    }
}
