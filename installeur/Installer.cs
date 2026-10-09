// Installe ou met à jour le mod "conso" pour Claude (onglet Code) et l'active pour toutes les discussions.
// Il télécharge la dernière version depuis GitHub (ou utilise celle qu'il embarque s'il est hors ligne),
// copie un dossier et ajoute une ligne à settings.json. Rien d'autre.
// Ses messages sont en français sur un système en français, en anglais sinon.
//
// Compiler (Windows, .NET Framework 4, déjà présent) : voir installeur/compiler.cmd.
using System;
using System.Collections.Generic;
using System.Globalization;
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
    // La langue des messages : celle du système, ou CONSO_LANG pour l'imposer.
    static readonly bool French = (Environment.GetEnvironmentVariable("CONSO_LANG") ?? CultureInfo.CurrentUICulture.Name).StartsWith("fr", StringComparison.OrdinalIgnoreCase);

    static string Say(string fr, string en)
    {
        return French ? fr : en;
    }

    static readonly string Title = Say("Mod Conso pour Claude", "Conso: token usage for Claude");
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
            string origin = fromWeb ? Say("téléchargée depuis GitHub", "downloaded from GitHub")
                : online == null ? Say("embarquée dans l'installeur (GitHub injoignable)", "bundled in the installer (GitHub unreachable)")
                : Say("embarquée dans l'installeur", "bundled in the installer");

            // Déjà installé ? L'installeur devient une mise à jour : il remplace les fichiers du mod, rien d'autre.
            string manifest = Path.Combine(target, ".claude-plugin", "plugin.json");
            string installed = File.Exists(manifest) ? VersionIn(File.ReadAllText(manifest)) : null;
            bool isUpdate = installed != null;
            if (!silent)
            {
                string ask;
                if (!isUpdate)
                {
                    ask = Say("Installer le mod Conso pour Claude ?", "Install the Conso mod for Claude?") + "\n\nVersion " + shipped + ", " + origin + ".\n\n"
                        + Say("1. Le mod est copié dans :", "1. The mod is copied to:") + "\n" + target + "\n\n"
                        + Say("2. Une ligne est ajoutée à :", "2. One line is added to:") + "\n" + settingsPath + "\n"
                        + Say("(l'ancien fichier est gardé en .avant-conso.bak)", "(the previous file is kept as .avant-conso.bak)");
                }
                else
                {
                    int order = Compare(installed, shipped);
                    if (order == 0)
                    {
                        MessageBox.Show(Say("Le mod Conso est déjà à jour (version ", "The Conso mod is already up to date (version ") + shipped + ").", Title, MessageBoxButtons.OK, MessageBoxIcon.Information);
                        return 0;
                    }
                    string head = order < 0 ? Say("Mettre à jour le mod Conso : version ", "Update the Conso mod: version ") + installed + " → " + shipped + Say(" ?", "?")
                        : Say("Attention : la version installée (", "Warning: the installed version (") + installed
                            + Say(") est plus récente que la version disponible (", ") is newer than the available version (") + shipped
                            + Say("). La remplacer quand même ?", "). Replace it anyway?");
                    ask = head + "\n\n" + Say("Nouvelle version ", "New version ") + origin + ".\n\n"
                        + Say("Les fichiers du mod sont remplacés dans :", "The mod's files are replaced in:") + "\n" + target + "\n\n"
                        + Say("Tes chiffres, ton historique et les limites déjà apprises sont conservés.", "Your figures, your history and the limits already learned are kept.");
                }
                if (MessageBox.Show(ask, Title, MessageBoxButtons.OKCancel, isUpdate ? MessageBoxIcon.Information : MessageBoxIcon.Question) != DialogResult.OK) return 1;
            }

            // 1. Le dossier du mod : l'ancien est retiré en entier, le nouveau prend sa place.
            if (Directory.Exists(target)) Directory.Delete(target, true);
            Directory.CreateDirectory(target);
            Extract(chosen, target);
            if (!File.Exists(manifest)) throw new Exception(Say("La copie du mod est incomplète.", "The mod was not copied completely."));

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
                    ? Say("Mise à jour terminée : version ", "Update complete: version ") + shipped + ".\n\n"
                        + Say("Ferme complètement Claude puis relance-le. Dans une discussion neuve, la commande /conso-refresh fait apparaître la bande dans les discussions déjà ouvertes.",
                              "Quit Claude completely and start it again. In a new conversation, the /conso-refresh command makes the band appear in conversations that were already open.")
                    : Say("Installation terminée : version ", "Installation complete: version ") + shipped + ".\n\n"
                        + Say("Ferme complètement Claude puis relance-le : la bande de conso apparaît au-dessus de la zone de saisie, et /conso ouvre le détail.\n\nPour mettre à jour plus tard, relance simplement cet installeur.",
                              "Quit Claude completely and start it again: the usage band appears above the prompt box, and /conso opens the details.\n\nTo update later, simply run this installer again.");
                if (!hasNode) done += "\n\n" + Say("Attention : Node.js est introuvable. Le mod en a besoin pour compter les tokens. Installe-le depuis https://nodejs.org puis relance Claude.",
                                                    "Warning: Node.js was not found. The mod needs it to count tokens. Install it from https://nodejs.org, then restart Claude.");
                MessageBox.Show(done, Title, MessageBoxButtons.OK, hasNode ? MessageBoxIcon.Information : MessageBoxIcon.Warning);
            }
            return 0;
        }
        catch (Exception error)
        {
            if (!silent) MessageBox.Show(Say("L'installation a échoué :", "The installation failed:") + "\n" + error.Message, Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 2;
        }
    }
}
