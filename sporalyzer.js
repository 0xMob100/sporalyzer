console.log(
`
        __.....__ 
     .'"         "\`. 
   .'               \`.  
  .                   . 
 .       __...__       .
. _.--"""       """--._ .
:"                     ";
 \`-.__    :   :    __.-'
      """-:   :-"""   
         J     L    
         :     :  
        J       L
        :       : 
        \`._____.' 
        Sporalyzer
`
);

const {JSONPath} = require('jsonpath-plus');

let args = require('minimist')(process.argv.slice(2));

const buildInfo = require(args.buildInfoPath);

// Get AST nodes of build info into a map by file ID

let files = [];

const inputFileSources = JSONPath({ json: buildInfo, path: "$.output.sources.*", resultType: "all"});

inputFileSources.forEach(
    (s) => { s.value.name = s.parentProperty; files[s.value.id] = s.value; }
);

const generatedSources = JSONPath({ json: buildInfo, path: `$.output.contracts..${args.mode}.generatedSources[*]`});

generatedSources.forEach(
    (s) => { files[s.id] = s; }
);

// Set up File -1 entry

files[-1] = { ast: {src: "-1:-2:-1", name: "(no function name)"}, name: "(File -1)", id: -1 };

// Get all source map and bytecode nodes

const bytecode = JSONPath({ json: buildInfo, path: `$.output.contracts..${args.mode}`})[0];

// Normalize the opcode listing so that PUSH instructions are single tokens, and trim excess data at the end

const opcodes = bytecode.opcodes.replace(/(PUSH\d+)\s+(\w+)/g, "$1_$2").replace(/INVALID.*$/, '').split(/\s/);

// Iterate through the source map entries and annotate AST nodes

function enumPathToLeaf(root, childEnum, childPredicate, mutator)
{
    childEnum(root).forEach((c) => {
        if ( childPredicate(c) ) enumPathToLeaf(c, childEnum, childPredicate, mutator);
    });
    mutator(root);
}

const sourceMapEntries = bytecode.sourceMap.split(';');

let entry = [ 0, 0, -1, '-', 0 ]; // Setting up in this scope so we can carry entry data forward between entries

sourceMapEntries.forEach((e, i) => {
    e.split(':').forEach((v, i) => { entry[i] = (v || entry[i]); });

    const opcodeByteSize = ((opcodes[i].match(/^PUSH(\d+)/) || [, "0"])[1] | 0) + 1;

    enumPathToLeaf(
        files[entry[2]].ast,
        (n) => { return n.statements || n.nodes || (n.body ? [n.body] : undefined) || []; },
        (c) => {
            const src = c.src.split(':');
            return (entry[0] | 0) >= (src[0] | 0) && ((entry[0] | 0) + (entry[1] | 0)) <= ((src[0] | 0) + (src[1] | 0));
        },
        (n) => {
            if ( n.byteSize === undefined ) n.byteSize = 0;
            n.byteSize += opcodeByteSize;
            if ( n.opCount === undefined ) n.opCount = 0;
            n.opCount++;
        }
    );
});

// Get all function definition AST nodes

let funcDefs = [];

files.forEach((f) => {
    const funcNodes = JSONPath({
        json: f.ast,
        path: `$..*[?(@.nodeType === "FunctionDefinition" || @.nodeType === "ModifierDefinition" || @.nodeType === "YulFunctionDefinition")]`
    });

    funcDefs.push(...funcNodes);
});

funcDefs.push(files[-1].ast);

// Sort by code size

funcDefs = funcDefs.sort((a, b) => {
    return (a.byteSize | 0) - (b.byteSize | 0);
});

// Output as a list

if ( args.outputType === "listing" )
{
    funcDefs.forEach((fd) => {
        console.log(`${fd.byteSize ? fd.byteSize : "?"}\t\t${files[fd.src.split(':')[2]].name}:${fd.name != "" ? fd.name : "(constructor)"}`);
    });
}

// Output 010 script

if ( args.outputType == "script" )
{
    let sha3 = require("js-sha3");

    function nameToColorHexString(name)
    {
        let colorHash = sha3.sha3_512.array(name);
        return `0x${colorHash[0]}${colorHash[1]}${colorHash[2]}`;
    }

    const scriptPreamble = `typedef struct {
        enum <ubyte> EvmOpcode {
            STOP = 0x00,
            ADD = 0x01,
            MUL = 0x02,
            SUB = 0x03,
            DIV = 0x04,
            SDIV = 0x05,
            MOD = 0x06,
            SMOD = 0x07,
            ADDMOD = 0x08,
            MULMOD = 0x09,
            EXP = 0x0A,
            SIGNEXTEND = 0x0B,
            INVALID_0C = 0x0C,
            INVALID_0D = 0x0D,
            INVALID_0E = 0x0E,
            INVALID_0F = 0x0F,
            LT = 0x10,
            GT = 0x11,
            SLT = 0x12,
            SGT = 0x13,
            EQ = 0x14,
            ISZERO = 0x15,
            AND = 0x16,
            OR = 0x17,
            XOR = 0x18,
            NOT = 0x19,
            _BYTE = 0x1A,
            SHL = 0x1B,
            SHR = 0x1C,
            SAR = 0x1D,
            INVALID_1E = 0x1E,
            INVALID_1F = 0x1F,
            SHA3 = 0x20,
            INVALID_21 = 0x21,
            INVALID_22 = 0x22,
            INVALID_23 = 0x23,
            INVALID_24 = 0x24,
            INVALID_25 = 0x25,
            INVALID_26 = 0x26,
            INVALID_27 = 0x27,
            INVALID_28 = 0x28,
            INVALID_29 = 0x29,
            INVALID_2A = 0x2A,
            INVALID_2B = 0x2B,
            INVALID_2C = 0x2C,
            INVALID_2D = 0x2D,
            INVALID_2E = 0x2E,
            INVALID_2F = 0x2F,
            ADDRESS = 0x30,
            BALANCE = 0x31,
            ORIGIN = 0x32,
            CALLER = 0x33,
            CALLVALUE = 0x34,
            CALLDATALOAD = 0x35,
            CALLDATASIZE = 0x36,
            CALLDATACOPY = 0x37,
            CODESIZE = 0x38,
            CODECOPY = 0x39,
            GASPRICE = 0x3A,
            EXTCODESIZE = 0x3B,
            EXTCODECOPY = 0x3C,
            RETURNDATASIZE = 0x3D,
            RETURNDATACOPY = 0x3E,
            EXTCODEHASH = 0x3F,
            BLOCKHASH = 0x40,
            COINBASE = 0x41,
            TIMESTAMP = 0x42,
            NUMBER = 0x43,
            DIFFICULTY = 0x44,
            GASLIMIT = 0x45,
            CHAINID = 0x46,
            SELFBALANCE = 0x47,
            BASEFEE = 0x48,
            INVALID_49 = 0x49,
            INVALID_4A = 0x4A,
            INVALID_4B = 0x4B,
            INVALID_4C = 0x4C,
            INVALID_4D = 0x4D,
            INVALID_4E = 0x4E,
            INVALID_4F = 0x4F,
            POP = 0x50,
            MLOAD = 0x51,
            MSTORE = 0x52,
            MSTORE8 = 0x53,
            SLOAD = 0x54,
            SSTORE = 0x55,
            JUMP = 0x56,
            JUMPI = 0x57,
            PC = 0x58,
            MSIZE = 0x59,
            GAS = 0x5A,
            JUMPDEST = 0x5B,
            INVALID_5C = 0x5C,
            INVALID_5D = 0x5D,
            INVALID_5E = 0x5E,
            INVALID_5F = 0x5F,
            PUSH1 = 0x60,
            PUSH2 = 0x61,
            PUSH3 = 0x62,
            PUSH4 = 0x63,
            PUSH5 = 0x64,
            PUSH6 = 0x65,
            PUSH7 = 0x66,
            PUSH8 = 0x67,
            PUSH9 = 0x68,
            PUSH10 = 0x69,
            PUSH11 = 0x6A,
            PUSH12 = 0x6B,
            PUSH13 = 0x6C,
            PUSH14 = 0x6D,
            PUSH15 = 0x6E,
            PUSH16 = 0x6F,
            PUSH17 = 0x70,
            PUSH18 = 0x71,
            PUSH19 = 0x72,
            PUSH20 = 0x73,
            PUSH21 = 0x74,
            PUSH22 = 0x75,
            PUSH23 = 0x76,
            PUSH24 = 0x77,
            PUSH25 = 0x78,
            PUSH26 = 0x79,
            PUSH27 = 0x7A,
            PUSH28 = 0x7B,
            PUSH29 = 0x7C,
            PUSH30 = 0x7D,
            PUSH31 = 0x7E,
            PUSH32 = 0x7F,
            DUP1 = 0x80,
            DUP2 = 0x81,
            DUP3 = 0x82,
            DUP4 = 0x83,
            DUP5 = 0x84,
            DUP6 = 0x85,
            DUP7 = 0x86,
            DUP8 = 0x87,
            DUP9 = 0x88,
            DUP10 = 0x89,
            DUP11 = 0x8A,
            DUP12 = 0x8B,
            DUP13 = 0x8C,
            DUP14 = 0x8D,
            DUP15 = 0x8E,
            DUP16 = 0x8F,
            SWAP1 = 0x90,
            SWAP2 = 0x91,
            SWAP3 = 0x92,
            SWAP4 = 0x93,
            SWAP5 = 0x94,
            SWAP6 = 0x95,
            SWAP7 = 0x96,
            SWAP8 = 0x97,
            SWAP9 = 0x98,
            SWAP10 = 0x99,
            SWAP11 = 0x9A,
            SWAP12 = 0x9B,
            SWAP13 = 0x9C,
            SWAP14 = 0x9D,
            SWAP15 = 0x9E,
            SWAP16 = 0x9F,
            LOG0 = 0xA0,
            LOG1 = 0xA1,
            LOG2 = 0xA2,
            LOG3 = 0xA3,
            LOG4 = 0xA4,
            INVALID_A5 = 0xA5,
            INVALID_A6 = 0xA6,
            INVALID_A7 = 0xA7,
            INVALID_A8 = 0xA8,
            INVALID_A9 = 0xA9,
            INVALID_AA = 0xAA,
            INVALID_AB = 0xAB,
            INVALID_AC = 0xAC,
            INVALID_AD = 0xAD,
            INVALID_AE = 0xAE,
            INVALID_AF = 0xAF,
            INVALID_B0 = 0xB0,
            INVALID_B1 = 0xB1,
            INVALID_B2 = 0xB2,
            INVALID_B3 = 0xB3,
            INVALID_B4 = 0xB4,
            INVALID_B5 = 0xB5,
            INVALID_B6 = 0xB6,
            INVALID_B7 = 0xB7,
            INVALID_B8 = 0xB8,
            INVALID_B9 = 0xB9,
            INVALID_BA = 0xBA,
            INVALID_BB = 0xBB,
            INVALID_BC = 0xBC,
            INVALID_BD = 0xBD,
            INVALID_BE = 0xBE,
            INVALID_BF = 0xBF,
            INVALID_C0 = 0xC0,
            INVALID_C1 = 0xC1,
            INVALID_C2 = 0xC2,
            INVALID_C3 = 0xC3,
            INVALID_C4 = 0xC4,
            INVALID_C5 = 0xC5,
            INVALID_C6 = 0xC6,
            INVALID_C7 = 0xC7,
            INVALID_C8 = 0xC8,
            INVALID_C9 = 0xC9,
            INVALID_CA = 0xCA,
            INVALID_CB = 0xCB,
            INVALID_CC = 0xCC,
            INVALID_CD = 0xCD,
            INVALID_CE = 0xCE,
            INVALID_CF = 0xCF,
            INVALID_D0 = 0xD0,
            INVALID_D1 = 0xD1,
            INVALID_D2 = 0xD2,
            INVALID_D3 = 0xD3,
            INVALID_D4 = 0xD4,
            INVALID_D5 = 0xD5,
            INVALID_D6 = 0xD6,
            INVALID_D7 = 0xD7,
            INVALID_D8 = 0xD8,
            INVALID_D9 = 0xD9,
            INVALID_DA = 0xDA,
            INVALID_DB = 0xDB,
            INVALID_DC = 0xDC,
            INVALID_DD = 0xDD,
            INVALID_DE = 0xDE,
            INVALID_DF = 0xDF,
            INVALID_E0 = 0xE0,
            INVALID_E1 = 0xE1,
            INVALID_E2 = 0xE2,
            INVALID_E3 = 0xE3,
            INVALID_E4 = 0xE4,
            INVALID_E5 = 0xE5,
            INVALID_E6 = 0xE6,
            INVALID_E7 = 0xE7,
            INVALID_E8 = 0xE8,
            INVALID_E9 = 0xE9,
            INVALID_EA = 0xEA,
            INVALID_EB = 0xEB,
            INVALID_EC = 0xEC,
            INVALID_ED = 0xED,
            INVALID_EE = 0xEE,
            INVALID_EF = 0xEF,
            CREATE = 0xF0,
            CALL = 0xF1,
            CALLCODE = 0xF2,
            RETURN = 0xF3,
            DELEGATECALL = 0xF4,
            CREATE2 = 0xF5,
            INVALID_F6 = 0xF6,
            INVALID_F7 = 0xF7,
            INVALID_F8 = 0xF8,
            INVALID_F9 = 0xF9,
            STATICCALL = 0xFA,
            INVALID_FB = 0xFB,
            INVALID_FC = 0xFC,
            REVERT = 0xFD,
            INVALID = 0xFE,
            SELFDESTRUCT = 0xFF
        };

        enum OpClass { Normal, Push, Metadata };

        local OpClass opClass = Normal;

        if ( ReadUByte() == LOG2 && ReadUInt(FTell() + 1) == 0x66706964 )
        {
            opClass = Metadata;
            ubyte metadataBlob[FileSize() - FTell()];
            break;
        }

        EvmOpcode op;

        if ( op >= PUSH1 && op <= PUSH32 )
        {
            opClass = Push;
            local uint immediateLength = op - (PUSH1 - 1);
            ubyte immediate[immediateLength];
        }
        
    } EvmOp <read = EvmOpToString>;

    string EvmOpToString(EvmOp& evmOp)
    {
        switch ( evmOp.opClass )
        {
            case Normal:
                return EnumToString(evmOp.op);

            case Push:
                local string immediateStr;
                local uint i;

                for ( i = 0; i < evmOp.immediateLength; i++ )
                {
                    immediateStr += Str("%02x", evmOp.immediate[i]);
                }
                return Str("%s <%s>", EnumToString(evmOp.op), immediateStr);

            case Metadata:
                return "Metadata blob";
        }

        return "Unknown op class";
    }`;

    entry = [ 0, 0, -1, '-', 0 ];

    let entryFuncInfo = [];
    let defaultFuncNode = {
        name: "(no function name)",
        src: "-1:-1:-1",
        opCount: 1
    };

    sourceMapEntries.forEach((e, i) => {
        e.split(':').forEach((v, i) => { entry[i] = (v || entry[i]); });

        let entryFuncNode = defaultFuncNode;

        enumPathToLeaf(
            files[entry[2]].ast,
            (n) => { return n.statements || n.nodes || (n.body ? [n.body] : undefined) || []; },
            (c) => {
                const src = c.src.split(':');
                return (entry[0] | 0) >= (src[0] | 0) && ((entry[0] | 0) + (entry[1] | 0)) <= ((src[0] | 0) + (src[1] | 0));
            },
            (n) => {
                if ( n.nodeType === "FunctionDefinition" || n.nodeType === "ModifierDefinition" || n.nodeType === "YulFunctionDefinition" )
                {
                    entryFuncNode = n;
                }
            }
        );

        entryFuncInfo.push(entryFuncNode);
    });

    console.log("010 Editor script for coloring by function:\n\n");

    console.log(scriptPreamble);
    entryFuncInfo.forEach((e, i) => { console.log(`EvmOp entry<bgcolor = ${nameToColorHexString("bg" + e.name)}, fgcolor = ${nameToColorHexString("fg" + e.name)}, comment = "${files[e.src.split(':')[2]].name}:${e.name != "" ? e.name : "(constructor)"}", optimize = false>;`)});
}
