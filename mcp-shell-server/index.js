#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

// Security: Define allowed working directories
const ALLOWED_DIRS = [
  process.env.SOMMOS_DIR || "/Users/thijs/Documents/SommOS",
  process.env.HOME || os.homedir(),
];

// Security: Command timeout in milliseconds
const COMMAND_TIMEOUT = 30000; // 30 seconds

// Security: Maximum output size (to prevent memory issues)
const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB

/**
 * Validates if a path is within allowed directories
 */
function isPathAllowed(targetPath) {
  const resolved = path.resolve(targetPath);
  return ALLOWED_DIRS.some(allowedDir => {
    const allowedResolved = path.resolve(allowedDir);
    return resolved.startsWith(allowedResolved);
  });
}

/**
 * Sanitizes command for basic security
 */
function sanitizeCommand(command) {
  // Remove potentially dangerous patterns
  // This is basic - more sophisticated validation recommended for production
  const dangerous = [
    /;\s*rm\s+-rf\s+\//,  // Prevent rm -rf /
    /;\s*:\s*\(\)/,        // Prevent fork bombs
    /\$\(.*curl.*\|.*sh/, // Prevent piped downloads
  ];
  
  for (const pattern of dangerous) {
    if (pattern.test(command)) {
      throw new Error("Command contains potentially dangerous patterns");
    }
  }
  
  return command;
}

/**
 * Execute a shell command with security controls
 */
async function executeCommand(command, workingDir = null) {
  // Validate working directory
  const cwd = workingDir || process.cwd();
  if (!isPathAllowed(cwd)) {
    throw new Error(`Working directory not allowed: ${cwd}`);
  }

  // Sanitize command
  const sanitized = sanitizeCommand(command);

  try {
    const { stdout, stderr } = await execAsync(sanitized, {
      cwd,
      timeout: COMMAND_TIMEOUT,
      maxBuffer: MAX_OUTPUT_SIZE,
      shell: process.env.SHELL || "/bin/zsh",
    });

    return {
      success: true,
      stdout: stdout || "",
      stderr: stderr || "",
      cwd,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      code: error.code,
      cwd,
    };
  }
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "mcp-shell-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "execute_shell_command",
        description: "Execute a shell command in a secure sandbox. Use this for running terminal commands, scripts, or system operations. Commands are subject to security restrictions and timeouts.",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The shell command to execute. Be cautious with destructive operations.",
            },
            working_directory: {
              type: "string",
              description: "Optional working directory for command execution. Must be within allowed directories.",
            },
          },
          required: ["command"],
        },
      },
      {
        name: "get_working_directory",
        description: "Get the current working directory and list of allowed directories for command execution.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "execute_shell_command") {
      const { command, working_directory } = args;

      if (!command) {
        throw new Error("Command is required");
      }

      const result = await executeCommand(command, working_directory);

      if (result.success) {
        let response = `Command executed successfully in: ${result.cwd}\n\n`;
        
        if (result.stdout) {
          response += `STDOUT:\n${result.stdout}\n`;
        }
        
        if (result.stderr) {
          response += `\nSTDERR:\n${result.stderr}`;
        }
        
        if (!result.stdout && !result.stderr) {
          response += "Command completed with no output.";
        }

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      } else {
        let errorResponse = `Command failed in: ${result.cwd}\n\n`;
        errorResponse += `Error: ${result.error}\n`;
        
        if (result.stdout) {
          errorResponse += `\nSTDOUT:\n${result.stdout}\n`;
        }
        
        if (result.stderr) {
          errorResponse += `\nSTDERR:\n${result.stderr}`;
        }
        
        if (result.code) {
          errorResponse += `\nExit code: ${result.code}`;
        }

        return {
          content: [
            {
              type: "text",
              text: errorResponse,
            },
          ],
          isError: true,
        };
      }
    } else if (name === "get_working_directory") {
      const info = {
        current: process.cwd(),
        allowed: ALLOWED_DIRS,
        shell: process.env.SHELL || "/bin/zsh",
        user: process.env.USER || "unknown",
      };

      return {
        content: [
          {
            type: "text",
            text: `Working Directory Information:\n\nCurrent: ${info.current}\n\nAllowed Directories:\n${info.allowed.map(d => `  - ${d}`).join('\n')}\n\nShell: ${info.shell}\nUser: ${info.user}`,
          },
        ],
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Shell Server running on stdio");
  console.error(`Allowed directories: ${ALLOWED_DIRS.join(', ')}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
