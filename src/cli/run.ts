#!/usr/bin/env node
/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

process.env.SUPPRESS_NO_CONFIG_WARNING = "true";

import { automationClient } from "@atomist/automation-client/automationClient";
import {
    Configuration,
    loadConfiguration,
} from "@atomist/automation-client/configuration";
import { HandlerContext } from "@atomist/automation-client/HandlerContext";
import { CommandInvocation } from "@atomist/automation-client/internal/invoker/Payload";
import { consoleMessageClient } from "@atomist/automation-client/internal/message/ConsoleMessageClient";
import { LoggingConfig } from "@atomist/automation-client/internal/util/logger";
import { guid } from "@atomist/automation-client/internal/util/string";
import { AutomationServer } from "@atomist/automation-client/server/AutomationServer";
import * as stringify from "json-stringify-safe";
import * as yargs from "yargs";

LoggingConfig.format = "cli";

if (yargs.argv.request) {
    try {
        const request: CommandInvocation = JSON.parse(yargs.argv.request);
        loadConfiguration()
            .then(configuration => {
                const node = automationClient(configuration);

                configuration.commands.forEach(c => {
                    node.withCommandHandler(c);
                });

                invokeOnConsole(node.automationServer, request, createHandlerContext(configuration));
            });

    } catch (e) {
        console.error(`Error: ${e.message}`);
        process.exit(1);
    }
} else {
    console.log("Error: Missing command request");
    process.exit(1);
}

function createHandlerContext(config: Configuration): HandlerContext {
    return {
        teamId: config.teamIds[0],
        correlationId: guid(),
        messageClient: consoleMessageClient,
    };
}

function invokeOnConsole(automationServer: AutomationServer, ci: CommandInvocation, ctx: HandlerContext) {

    // Set up the parameter, mappend parameters and secrets
    const handler = automationServer.automations.commands.find(c => c.name === ci.name);
    const invocation: CommandInvocation = {
        name: ci.name,
        args: ci.args ? ci.args.filter(a =>
            handler.parameters.some(p => p.name === a.name)) : undefined,
        mappedParameters: ci.args ? ci.args.filter(a =>
            handler.mapped_parameters.some(p => p.name === a.name)) : undefined,
        secrets: ci.args ? ci.args.filter(a => handler.secrets.some(p => p.name === a.name))
            .map(a => {
                const s = handler.secrets.find(p => p.name === a.name);
                return { uri: s.uri, value: a.value };
            }) : undefined,
    };

    try {
        automationServer.validateCommandInvocation(invocation);
    } catch (e) {
        console.log("Error: Invalid parameters: %s", e.message);
        process.exit(1);
    }
    try {
        automationServer.invokeCommand(invocation, ctx)
            .then(r => {
                console.log(`Command succeeded: ${stringify(r, null, 2)}`);
                process.exit(0);
            })
            .catch(err => {
                console.log(`Error: Command failed: ${stringify(err, null, 2)}`);
                process.exit(1);
            });
    } catch (e) {
        console.log("Unhandled Error: Command failed: %s", e.message);
        process.exit(11);
    }
}