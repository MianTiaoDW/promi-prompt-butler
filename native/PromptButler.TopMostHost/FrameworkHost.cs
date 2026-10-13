using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;

// Windows includes .NET Framework, so installing the helper does not require an SDK.
internal static class FrameworkHost
{
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();

    private static void Main(string[] args)
    {
        Log("启动参数：" + string.Join(" ", args));
        using (Stream input = Console.OpenStandardInput())
        using (Stream output = Console.OpenStandardOutput())
        {
            try
            {
                long handle = 0;
                foreach (string arg in args)
                    if (arg.StartsWith("--parent-window="))
                        long.TryParse(arg.Substring("--parent-window=".Length), out handle);
                IntPtr window = new IntPtr(handle);
                if (window == IntPtr.Zero || !IsWindow(window))
                    throw new InvalidOperationException("未获取到当前插件窗口句柄。");

                byte[] header = Read(input, 4);
                int length = BitConverter.ToInt32(header, 0);
                if (length <= 0 || length > 1024 * 1024)
                    throw new InvalidDataException("Native Messaging 消息长度无效。");
                var request = Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(Read(input, length)));
                string type = (string)request["type"];
                if (type == "window:set-always-on-top")
                {
                    bool enabled = (bool)request["enabled"];
                    if (!SetWindowPos(window, new IntPtr(enabled ? -1 : -2), 0, 0, 0, 0, 0x53))
                        throw new InvalidOperationException("Windows 置顶调用失败：" + Marshal.GetLastWin32Error());
                }
                else if (type != "window:get-always-on-top")
                    throw new InvalidOperationException("不支持的窗口操作。");

                bool pinned = (GetWindowLongPtr(window, -20).ToInt64() & 8) != 0;
                Write(output, new { ok = true, enabled = pinned });
            }
            catch (Exception error)
            {
                Log(error.Message);
                Write(output, new { ok = false, message = error.Message });
            }
        }
    }

    private static void Log(string message)
    {
        try
        {
            File.AppendAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "window-host.log"),
                DateTime.UtcNow.ToString("o") + " " + message + Environment.NewLine);
        }
        catch { }
    }

    private static byte[] Read(Stream input, int length)
    {
        byte[] buffer = new byte[length];
        int offset = 0;
        while (offset < length)
        {
            int count = input.Read(buffer, offset, length - offset);
            if (count == 0) throw new EndOfStreamException("Native Messaging 消息不完整。");
            offset += count;
        }
        return buffer;
    }

    private static void Write(Stream output, object response)
    {
        byte[] payload = Encoding.UTF8.GetBytes(Json.Serialize(response));
        byte[] header = BitConverter.GetBytes(payload.Length);
        output.Write(header, 0, header.Length);
        output.Write(payload, 0, payload.Length);
        output.Flush();
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
    private static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
}
