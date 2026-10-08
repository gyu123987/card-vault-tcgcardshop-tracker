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
    readonly bool sourceMode = !String.IsNullOrEmpty(Environment.GetEnvironmentVariable("CARD_VAULT_SOURCE_ROOT"));
    readonly string root = Environment.GetEnvironmentVariable("CARD_VAULT_SOURCE_ROOT") ?? AppDomain.CurrentDomain.BaseDirectory;
    readonly string store = Environment.GetEnvironmentVariable("CARD_VAULT_HOME") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CardVault");
    string CacheRoot { get { return sourceMode?root:store; } }
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
        Text="Card Vault"; Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath); ClientSize=new Size(760,595); MinimumSize=new Size(650,620); StartPosition=FormStartPosition.CenterScreen;
        Font=new Font("Segoe UI",10); BackColor=Color.FromArgb(244,245,239); ForeColor=Color.FromArgb(32,54,46);
        Directory.CreateDirectory(store);
        var layout=new TableLayoutPanel {Dock=DockStyle.Fill,Padding=new Padding(24),ColumnCount=1,RowCount=9};
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,52));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,44));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,60));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,60));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,52));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,30));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent,100));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,70));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,24));
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
        updates=new Button {Text="Check for updates",AutoSize=true};updates.Click+=async(s,e)=>{if(releaseUrl!=null)Process.Start(new ProcessStartInfo(releaseUrl){UseShellExecute=true});else await CheckUpdates();};footer.Controls.Add(updates);
        var uninstall=new Button {Text="Uninstall…",AutoSize=true,ForeColor=Color.DarkRed};uninstall.Click+=(s,e)=>Uninstall();footer.Controls.Add(uninstall);layout.Controls.Add(footer);
        layout.Controls.Add(new Label {Text="Game saves stay untouched. Keep this launcher open while using the tracker.",AutoSize=true,Font=new Font("Segoe UI",9)});
        retrieve.Click+=async(s,e)=>await Retrieve();open.Click+=async(s,e)=>await Open();
        Shown+=async(s,e)=>{
            var updateTask=CheckUpdates();
            if(game.Text.Length==0){try {var found=await RunPython("--detect-only",false);if(found.Trim().Length>0)game.Text=found.Trim();}catch {Write("Choose the folder containing Card Shop Simulator_Data.");}}
            Write(CacheReady()?"Ready. Click Open Card Vault. Asset refresh is manual: keep your current cache after a game update until you are ready to refresh.":"Setup or asset refresh needed. Click Retrieve / refresh assets to include artwork and net-worth prices.");
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
    bool CacheReady(){
        if(!File.Exists(Path.Combine(CacheRoot,"data/catalog.json"))||!File.Exists(Path.Combine(CacheRoot,"public/assets/render-data.json")))return false;
        try {
            var json=new JavaScriptSerializer {MaxJsonLength=32*1024*1024};
            var catalog=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(CacheRoot,"data/catalog.json")));
            var economy=catalog.ContainsKey("economy")?catalog["economy"] as Dictionary<string,object>:null;
            return economy!=null&&economy.ContainsKey("items");
        }catch {return false;}
    }
    void Write(string text){if(IsDisposed||String.IsNullOrWhiteSpace(text))return;if(InvokeRequired){BeginInvoke(new Action<string>(Write),text);return;}log.AppendText(text+Environment.NewLine);}
    static string Quote(string s){return "\""+s.Replace("\"", "") .TrimEnd('\\')+"\"";}
    async Task<string> RunPython(string args,bool show) {
        var program=sourceMode?Environment.GetEnvironmentVariable("CARD_VAULT_SOURCE_PYTHON"):Path.Combine(root,"runtime/python/python.exe");
        var prefix=sourceMode?Environment.GetEnvironmentVariable("CARD_VAULT_SOURCE_PYTHON_ARGS")+" ":"";
        var info=new ProcessStartInfo(program,prefix+"-u "+Quote(Path.Combine(root,sourceMode?"tools/retrieve_assets.py":"app/tools/retrieve_assets.py"))+" "+args){WorkingDirectory=sourceMode?root:Path.Combine(root,"app"),UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
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
        try {Settings();if(sourceMode)await RetrieveSource();else await RunPython("--game "+Quote(game.Text.Trim())+" --output "+Quote(store),true);Write("Assets ready. Click Open Card Vault.");return true;}
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
                var info=new ProcessStartInfo(sourceMode?Environment.GetEnvironmentVariable("CARD_VAULT_SOURCE_NODE"):Path.Combine(root,"runtime/node/node.exe"),Quote(Path.Combine(root,sourceMode?"server.mjs":"app/server.mjs"))){WorkingDirectory=sourceMode?root:Path.Combine(root,"app"),UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
                info.EnvironmentVariables["TCG_DATA_DIR"]=sourceMode?store:Path.Combine(store,"data");info.EnvironmentVariables["TCG_ASSET_DIR"]=Path.Combine(CacheRoot,"public/assets");info.EnvironmentVariables["TCG_SAVE_DIR"]=saves.Text.Trim();info.EnvironmentVariables["PORT"]=sourceMode?"4317":"4318";runningSave=saves.Text.Trim();
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
    void Uninstall() {
        if(working){MessageBox.Show("Wait for asset retrieval to finish before uninstalling.","Card Vault");return;}
        if(sourceMode){UninstallSource();return;}
        var expected=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"CardVault");
        if(!String.Equals(Path.GetFullPath(store).TrimEnd('\\'),Path.GetFullPath(expected).TrimEnd('\\'),StringComparison.OrdinalIgnoreCase)||!File.Exists(Path.Combine(root,"card-vault-package.txt"))){MessageBox.Show("Automatic uninstall is available for the packaged app with its standard data folder. Remove this custom installation manually.","Card Vault");return;}
        if(MessageBox.Show("Uninstall Card Vault and permanently delete its artwork cache, drafts, records, settings and sync history?\n\nApp: "+root+"\nData: "+store+"\n\nGame files and game saves will stay untouched. Other extracted copies of Card Vault will remain.","Uninstall Card Vault",MessageBoxButtons.YesNo,MessageBoxIcon.Warning,MessageBoxDefaultButton.Button2)!=DialogResult.Yes)return;
        try {
            var id=Guid.NewGuid().ToString("N");
            var helper=Path.Combine(Path.GetTempPath(),"CardVault-uninstall-"+id+".ps1");
            var plan=Path.Combine(Path.GetTempPath(),"CardVault-uninstall-"+id+".json");
            File.Copy(Path.Combine(root,"Uninstall-CardVault.ps1"),helper);
            File.WriteAllText(plan,new JavaScriptSerializer().Serialize(new {app=root,data=store,game=game.Text.Trim(),saves=saves.Text.Trim(),process=Process.GetCurrentProcess().Id}));
            var powershell=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe");
            StopServer();
            Process.Start(new ProcessStartInfo(powershell,"-NoProfile -ExecutionPolicy Bypass -File "+Quote(helper)+" -PlanPath "+Quote(plan)){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden});
            Close();
        }catch(Exception ex){MessageBox.Show("Could not start uninstall: "+ex.Message,"Card Vault");}
    }
    async Task RetrieveSource() {
        var info=new ProcessStartInfo("powershell.exe","-NoProfile -ExecutionPolicy Bypass -File "+Quote(Path.Combine(root,"Retrieve-GameAssets.ps1"))+" -GameDirectory "+Quote(game.Text.Trim())){WorkingDirectory=root,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
        using(var process=new Process {StartInfo=info}){
            process.OutputDataReceived+=(s,e)=>Write(e.Data);process.ErrorDataReceived+=(s,e)=>Write(e.Data);
            process.Start();process.BeginOutputReadLine();process.BeginErrorReadLine();await Task.Run(()=>process.WaitForExit());
            if(process.ExitCode!=0)throw new Exception("Asset retrieval failed. See the progress log.");
        }
    }
    void UninstallSource() {
        if(MessageBox.Show("Permanently delete this entire Card Vault folder after the launcher closes?\n\nFolder: "+root+"\n\nThis includes source code, Git history, drafts, records, sync history, cached artwork, local tools, and ANY other files inside this folder. Back up anything you want to keep first.\n\nInstalled Node/Python, other Card Vault installations, and game files/saves outside this folder are kept.","Uninstall Card Vault completely",MessageBoxButtons.YesNo,MessageBoxIcon.Warning,MessageBoxDefaultButton.Button2)!=DialogResult.Yes)return;
        try{
            var id=Guid.NewGuid().ToString("N");var helper=Path.Combine(Path.GetTempPath(),"CardVault-source-uninstall-"+id+".ps1");var plan=Path.Combine(Path.GetTempPath(),"CardVault-source-uninstall-"+id+".json");
            File.Copy(Path.Combine(root,"desktop/Uninstall-Source.ps1"),helper);
            File.WriteAllText(plan,new JavaScriptSerializer().Serialize(new {app=root,game=game.Text.Trim(),saves=saves.Text.Trim(),process=Process.GetCurrentProcess().Id,fullRemovalConfirmed=true}));
            StopServer();Process.Start(new ProcessStartInfo("powershell.exe","-NoProfile -ExecutionPolicy Bypass -File "+Quote(helper)+" -PlanPath "+Quote(plan)){WorkingDirectory=Path.GetTempPath(),UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden});Close();
        }catch(Exception ex){MessageBox.Show("Could not start uninstall: "+ex.Message,"Card Vault");}
    }
    void StopServer(){if(server!=null){try{if(!server.HasExited)server.Kill();}catch{}server.Dispose();server=null;url=null;}}
}
