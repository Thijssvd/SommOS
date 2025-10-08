# MCP Shell Server
 
 A secure Model Context Protocol (MCP) server for executing shell commands with safety controls.
 
 > Notice
 >
 > The primary MCP platform for SommOS is the external Agent-MCP suite, which exposes an SSE server at `http://localhost:8080/sse` and stores state in:
 > `/Users/thijs/Documents/SommOS/.agent/mcp_state.db`.
 >
 > This local `mcp-shell-server` is optional. Prefer the Agent-MCP suite for production and day-to-day operations. Keep this server only if you explicitly need an embedded stdio MCP in this repository. Otherwise, archive or disable it to avoid duplication and operator confusion.
 
 ## Features

- **Secure Command Execution**: Commands run with timeout limits and output size restrictions
- **Directory Sandboxing**: Only allowed directories can be used for command execution
- **Command Sanitization**: Basic protection against dangerous command patterns
- **Detailed Output**: Captures stdout, stderr, and exit codes
## Security Features

1. **Allowed Directories**: Commands can only execute in:
   - `/Users/thijs/Documents/SommOS`
   - Your home directory (`$HOME`)

2. **Command Timeout**: 30 seconds maximum execution time
3. **Output Limits**: 1MB maximum output size
4. **Pattern Blocking**: Prevents obviously dangerous patterns like:
   - `rm -rf /`
   - Fork bombs
   - Piped curl downloads

## Installation

```bash
cd /Users/thijs/Documents/SommOS/mcp-shell-server
npm install
chmod +x index.js
```

## Tools Provided

### 1. `execute_shell_command`
Execute a shell command with security controls.

**Arguments:**
- `command` (required): The shell command to execute
- `working_directory` (optional): Directory to run the command in

**Example:**
```json
{
  "command": "ls -la",
  "working_directory": "/Users/thijs/Documents/SommOS"
}
```

### 2. `get_working_directory`
Get information about the current working directory and security settings.

**Example:**
```json
{}
```

## Configuration in Warp

Add this to your Warp MCP configuration file (`~/.warp/mcp_servers.json`):

```json
{
  "mcpServers": {
    "shell": {
      "command": "node",
      "args": ["/Users/thijs/Documents/SommOS/mcp-shell-server/index.js"],
      "env": {
        "SOMMOS_DIR": "/Users/thijs/Documents/SommOS"
      }
    }
  }
}
```

## Usage Examples

Once configured in Warp, you can use the shell tools from Warp AI:

- "Execute `git status` in the SommOS directory"
- "Run `npm test` in the current directory"
- "Show me the directory structure with `tree -L 2`"

## Customization

To allow additional directories, edit `index.js` and modify the `ALLOWED_DIRS` array:

```javascript
const ALLOWED_DIRS = [
  process.env.SOMMOS_DIR || "/Users/thijs/Documents/SommOS",
  process.env.HOME || os.homedir(),
  "/path/to/another/allowed/directory",
];
```

## Warning

⚠️ **Security Notice**: This server allows command execution on your system. While it includes basic security measures, you should:

1. Only use it with trusted AI systems
2. Review commands before they execute if possible
3. Consider adding more restrictive controls for production use
4. Add command whitelisting if you know the specific commands you need

## Troubleshooting

**Server doesn't start:**
- Check Node.js version (requires 18+)
- Ensure dependencies are installed: `npm install`
- Verify the script is executable: `chmod +x index.js`

**Commands fail:**
- Check if the working directory is in ALLOWED_DIRS
- Verify the command doesn't contain blocked patterns
- Check command syntax is valid for your shell (zsh)

**Permission denied:**
- Ensure the working directory has proper permissions
- Check that files being executed are executable (`chmod +x`)
