using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Net;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

// Small native launcher. All card data remains on this machine.
class CardVault : Form {
    readonly string root = AppDomain.CurrentDomain.BaseDirectory;
    readonly string store = Environment.GetEnvironmentVariable("CARD_VAULT_HOME") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CardVault");
    TextBox game, saves, log;
    Button retrieve, open;
    Process server;
    string url, runningSave;
    bool working;
    Button updates;
    string releaseUrl;
    const string Releases="https://github.com/gyu123987/card-vault-tcgcardshop-tracker/releases/latest";
    static Mutex single;

    [STAThread] static void Main(string[] args) {
        bool first;
        single = new Mutex(true, "Local\\CardVaultDesktop", out first);
        if (!first) { MessageBox.Show("Card Vault is already running. Open its launcher window to return to the tracker.", "Card Vault"); return; }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new CardVault());
    }
    CardVault() {
        Text="Card Vault"; Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath); ClientSize=new Size(760,565); MinimumSize=new Size(650,590); StartPosition=FormStartPosition.CenterScreen;
        Font=new Font("Segoe UI",10); BackColor=Color.FromArgb(244,245,239); ForeColor=Color.FromArgb(32,54,46);
        Directory.CreateDirectory(store);
        var layout=new TableLayoutPanel {Dock=DockStyle.Fill,Padding=new Padding(24),ColumnCount=1,RowCount=9};
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,52));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,44));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,60));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,60));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,52));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,30));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent,100));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,40));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,24));
        Controls.Add(layout);
        layout.Controls.Add(new Label {Text="Card Vault",Font=new Font("Segoe UI",24,FontStyle.Bold),AutoSize=true});
        layout.Controls.Add(new Label {Text="Your local card companion. Choose your folders once, retrieve artwork, then open the tracker.",Dock=DockStyle.Fill});
        game=FolderRow(layout,"Game installation",ReadSetting("game-folder.txt"));
        saves=FolderRow(layout,"Game saves",ReadSetting("save-folder.txt"));
        if(saves.Text.Length==0)saves.Text=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),@"AppData\LocalLow\OPNeonGames\Card Shop Simulator");
        var buttons=new FlowLayoutPanel {Dock=DockStyle.Fill};
        retrieve=new Button {Text="Retrieve / refresh assets",AutoSize=true,Height=36};
        open=new Button {Text="Open Card Vault",AutoSize=true,Height=36,BackColor=Color.FromArgb(212,229,199)};
        buttons.Controls.Add(retrieve);buttons.Controls.Add(open);layout.Controls.Add(buttons);
        layout.Controls.Add(new Label {Text="Setup progress",AutoSize=true});
        log=new TextBox {Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Vertical,Dock=DockStyle.Fill,BackColor=Color.White,Font=new Font("Segoe UI",9)};layout.Controls.Add(log);
        var footer=new FlowLayoutPanel {Dock=DockStyle.Fill};
        var files=new Button {Text="Open my Card Vault data folder",AutoSize=true};files.Click+=(s,e)=>Process.Start(new ProcessStartInfo(store){UseShellExecute=true});footer.Controls.Add(files);
        updates=new Button {Text="Check for updates",AutoSize=true};updates.Click+=async(s,e)=>{if(releaseUrl!=null)Process.Start(new ProcessStartInfo(releaseUrl){UseShellExecute=true});else await CheckUpdates();};footer.Controls.Add(updates);layout.Controls.Add(footer);
        layout.Controls.Add(new Label {Text="Game saves stay untouched. Keep this launcher open while using the tracker.",AutoSize=true,Font=new Font("Segoe UI",9)});
        retrieve.Click+=async(s,e)=>await Retrieve();open.Click+=async(s,e)=>await Open();
        Shown+=async(s,e)=>{
            var updateTask=CheckUpdates();
            if(game.Text.Length==0){try {var found=await RunPython("--detect-only",false);if(found.Trim().Length>0)game.Text=found.Trim();}catch {Write("Choose the folder containing Card Shop Simulator_Data.");}}
            Write(CacheReady()?"Ready. Click Open Card Vault. Refresh assets after a game update.":"First run: click Retrieve / refresh assets. No downloads or coding tools are needed.");
        };
        FormClosing+=(s,e)=>{if(working){MessageBox.Show("Wait for asset retrieval to finish before closing.","Card Vault");e.Cancel=true;}else StopServer();};
    }
    async Task CheckUpdates() {
        updates.Enabled=false;
        try {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            using(var client=new WebClient()) {
                client.Headers[HttpRequestHeader.UserAgent]="CardVault/"+Application.ProductVersion;
                client.Headers[HttpRequestHeader.Accept]="application/vnd.github+json";
                var request=client.DownloadStringTaskAsync("https://api.github.com/repos/gyu123987/card-vault-tcgcardshop-tracker/releases/latest");
                if(await Task.WhenAny(request,Task.Delay(8000))!=request){client.CancelAsync();Write("Update check timed out. You can continue offline.");return;}
                var data=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(await request);
                Version latest,current;
                var tag=Convert.ToString(data["tag_name"]);
                if(!Version.TryParse(tag.TrimStart('v'),out latest)||!Version.TryParse(Application.ProductVersion,out current))throw new Exception("Unrecognized release version");
                if(latest>current){releaseUrl=Releases;updates.Text="Download "+tag;Write("Update available: "+tag+". Download and extract the new ZIP, then close this launcher and run the new copy. Your data stays in "+store);}
                else Write("Card Vault "+Application.ProductVersion+" is up to date.");
            }
        }catch(WebException){Write("Update check unavailable (offline, rate limit, private repository or no published release). Continue normally; check GitHub Releases later.");}
        catch(Exception){Write("Could not read release information. Continue normally; check GitHub Releases later.");}
        finally {if(!IsDisposed)updates.Enabled=true;}
    }
    TextBox FolderRow(TableLayoutPanel parent,string title,string value) {
        var row=new TableLayoutPanel {Dock=DockStyle.Fill,ColumnCount=2,RowCount=2};row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,86));
        row.Controls.Add(new Label {Text=title,AutoSize=true},0,0);
        var box=new TextBox {Text=value,Dock=DockStyle.Fill};row.Controls.Add(box,0,1);
        var browse=new Button {Text="Browse…",Dock=DockStyle.Fill};row.Controls.Add(browse,1,1);
        browse.Click+=(s,e)=>{using(var dialog=new FolderBrowserDialog {Description=title,SelectedPath=box.Text})if(dialog.ShowDialog(this)==DialogResult.OK)box.Text=dialog.SelectedPath;};
        parent.Controls.Add(row);return box;
    }
    string ReadSetting(string file){var p=Path.Combine(store,file);return File.Exists(p)?File.ReadAllText(p):"";}
    void Settings(){File.WriteAllText(Path.Combine(store,"game-folder.txt"),game.Text.Trim());File.WriteAllText(Path.Combine(store,"save-folder.txt"),saves.Text.Trim());}
    bool CacheReady(){return File.Exists(Path.Combine(store,"data/catalog.json"))&&File.Exists(Path.Combine(store,"public/assets/render-data.json"));}
    void Write(string text){if(IsDisposed||String.IsNullOrWhiteSpace(text))return;if(InvokeRequired){BeginInvoke(new Action<string>(Write),text);return;}log.AppendText(text+Environment.NewLine);}
    static string Quote(string s){return "\""+s.Replace("\"", "") .TrimEnd('\\')+"\"";}
    async Task<string> RunPython(string args,bool show) {
        var info=new ProcessStartInfo(Path.Combine(root,"runtime/python/python.exe"),"-u "+Quote(Path.Combine(root,"app/tools/retrieve_assets.py"))+" "+args){WorkingDirectory=Path.Combine(root,"app"),UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
        using(var process=new Process {StartInfo=info}) {
            var output=new StringBuilder();var errors=new StringBuilder();
            process.OutputDataReceived+=(s,e)=>{if(e.Data!=null){lock(output)output.AppendLine(e.Data);if(show)Write(e.Data);}};
            process.ErrorDataReceived+=(s,e)=>{if(e.Data!=null){lock(errors)errors.AppendLine(e.Data);if(show)Write(e.Data);}};
            process.Start();process.BeginOutputReadLine();process.BeginErrorReadLine();await Task.Run(()=>process.WaitForExit());
            if(process.ExitCode!=0)throw new Exception("Asset tool failed. "+errors.ToString());return output.ToString();
        }
    }
    async Task<bool> Retrieve() {
        if(working)return false;
        if(!File.Exists(Path.Combine(game.Text.Trim(),"Card Shop Simulator_Data/sharedassets1.assets"))){MessageBox.Show("Choose the game installation folder containing Card Shop Simulator_Data.","Game folder needed");return false;}
        working=true;retrieve.Enabled=false;open.Enabled=false;game.Enabled=false;saves.Enabled=false;
        StopServer();Write("Retrieving artwork from your installed game. This can take several minutes…");
        try {Settings();await RunPython("--game "+Quote(game.Text.Trim())+" --output "+Quote(store),true);Write("Assets ready. Click Open Card Vault.");return true;}
        catch(Exception ex){Write(ex.Message);MessageBox.Show("Retrieval did not finish. Your previous cache and game saves are unchanged. See the progress log for details.","Card Vault");return false;}
        finally {working=false;retrieve.Enabled=true;open.Enabled=true;game.Enabled=true;saves.Enabled=true;}
    }
    async Task Open() {
        if(working)return;
        if(!Directory.Exists(saves.Text.Trim())||Directory.GetFiles(saves.Text.Trim(),"savedGames_Release*.json").Length==0){MessageBox.Show("Choose the game save folder. Start and save a game first if you have no save files yet.","Save folder needed");return;}
        if(!CacheReady()&&!await Retrieve())return;
        try {
            Settings();
            if(server!=null && runningSave!=saves.Text.Trim()) StopServer();
            if(server==null||server.HasExited){
                open.Enabled=false;
                var ready=new TaskCompletionSource<string>();
                var info=new ProcessStartInfo(Path.Combine(root,"runtime/node/node.exe"),Quote(Path.Combine(root,"app/server.mjs"))){WorkingDirectory=Path.Combine(root,"app"),UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
                info.EnvironmentVariables["TCG_DATA_DIR"]=Path.Combine(store,"data");info.EnvironmentVariables["TCG_ASSET_DIR"]=Path.Combine(store,"public/assets");info.EnvironmentVariables["TCG_SAVE_DIR"]=saves.Text.Trim();info.EnvironmentVariables["PORT"]="4318";runningSave=saves.Text.Trim();
                server=new Process {StartInfo=info,EnableRaisingEvents=true};
                server.OutputDataReceived+=(s,e)=>{if(e.Data!=null){Write(e.Data);var marker="Card Vault ready at ";if(e.Data.StartsWith(marker))ready.TrySetResult(e.Data.Substring(marker.Length));}};
                server.ErrorDataReceived+=(s,e)=>Write(e.Data);server.Exited+=(s,e)=>ready.TrySetException(new Exception("The local server stopped. Check the log."));
                server.Start();server.BeginOutputReadLine();server.BeginErrorReadLine();
                if(await Task.WhenAny(ready.Task,Task.Delay(30000))!=ready.Task)throw new Exception("The tracker did not start within 30 seconds.");
                url=await ready.Task;
            }
            Process.Start(new ProcessStartInfo(url){UseShellExecute=true});Write("Tracker opened. Closing this launcher stops its local server.");
        }catch(Exception ex){StopServer();Write(ex.Message);MessageBox.Show(ex.Message,"Card Vault could not start");}finally{open.Enabled=true;}
    }
    void StopServer(){if(server!=null){try{if(!server.HasExited)server.Kill();}catch{}server.Dispose();server=null;url=null;}}
}
