import yargs from "yargs";
import Zotero from "zotero-lib";
import axios from "axios";

const argv = yargs(process.argv.slice(2))
  .command("items [items...]", "Process items")
  .option("group", {
    describe: "Group ID",
    type: "number",
  })
  .option("test", {
    describe: "Test mode",
    type: "boolean",
    default: false,
  })
  .demandCommand()
  .help().argv;

main(argv);

// Instead of this, it would be better to write some JQ and use the JQ function to do this.
// The jq string is quite similar, but basically closer to json than ts. I'm getting it's something like this:
/*
filter = "{
  volume: .volume;
  issue: .issue,
  pages: .page,
  journalAbbreviation: .['short-container-title'],
  publicationTitle: .['container-title'],
  url: .URL
}";

jq.run(filter,json_in, { input: 'json', output: 'json' }).then(console.log)

*/
const crossrefKeys = {
  volume: "volume",
  issue: "issue",
  pages: "page",
  journalAbbreviation: "short-container-title",
  publicationTitle: "container-title",
  url: "URL",
};

async function getCrossref(doi: string) {
  const url = `https://api.crossref.org/works/${doi}`;
  const res = await axios.get(url);
  return res.data;
}

async function extractKeyGroupVariable(key: any) {
  key = key.toString();
  const res = key.match(
    /^zotero\:\/\/select\/groups\/(library|\d+)\/(items|collections)\/([A-Z01-9]+)/
  );

  if (res) {
    if (res[2] === "library") {
      console.log(
        "You cannot specify zotero-select links (zotero://...) to select user libraries."
      );
      return [null, null];
    }
    // if the input is like zotero://select/groups/2405685/items/JLEWADHF
    return [res[1], res[3]];
  }

  if (!res) {
    if (key.match(/^([A-Z01-9]+)/)) {
      // if the input like 2405685:JLEWADHF
      const match = key.match(/^(\d+):([A-Z01-9]+)/);
      if (match) {
        return [match[1], match[2]];
      }
      // if the input like JLEWADHF
      return [undefined, key];
    }
  }
  // the input is not a valid key
  return [undefined, undefined];
}

async function main(argv: any) {
  const items = argv.items;
  if (!items) {
    console.log("No items specified");
    return;
  }
  for (const item of items) {
    // extract the group and id from the item
    const [group, id] = await extractKeyGroupVariable(item);
    if (!group && !argv.group) {
      console.log(`No group specified so the item ${id} will not be processed`);
      continue;
    }
    const group_actual = argv.group ? argv.group : group;
    await process_item(group_actual, id, argv.test);
  }
}

function as_value(value: any) {
  if (Array.isArray(value)) {
    value = value[0];
  }
  return value;
}

async function process_item(group: string, id: string, test: boolean) {
  const zotero = new Zotero({ group_id: group, verbose: false });
  try {
    const item = await zotero.item({ key: [id] });
    if (item === undefined) {
      console.log(`Item ${id} not found`);
      return;
    }

    if (item.itemType !== "journalArticle") {
      console.log("Not a journal article");
      return;
    }
    const doi = await zotero.get_doi(item);
    if (doi === undefined) {
      console.log("DOI not found");
      return;
    }
    const crossref = await getCrossref(doi);

    //   fs.writeFileSync('crossref.json', JSON.stringify(crossref));
    //   fs.writeFileSync('item.json', JSON.stringify(item));

    let fields: any = {};
    for (const [sourceKey, targetKey] of Object.entries(crossrefKeys)) {
      const sourceValue = item[sourceKey];
      const targetValue = crossref.message[targetKey];

      if (!sourceValue && targetValue) {
        if (sourceKey === "journalAbbreviation") {
          fields[sourceKey] = as_value(targetValue);
        } else fields[sourceKey] = targetValue;
      }
    }

    if (Object.keys(fields).length === 0) {
      console.log(`Nothing to update for ${id}`);
      return;
    }
    console.log("what needs to be updated", fields);
    if (!test) {
      const update = await zotero.update_item({
        group: group,
        verbose: false,

        key: id,
        json: fields,
      });
      if (update.statusCode === 204) {
        console.log(`Item ${id} updated`);
      }
    }
  } catch (e) {
    console.log(`Error processing item ${id}`);
    return;
  }
}
