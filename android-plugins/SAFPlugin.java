package app.lovable.e61fee5bc92f456f8684aa0b1a8db0a3.plugins;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.content.Context;
import android.media.MediaScannerConnection;

import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.*;

import org.json.JSONObject;

@CapacitorPlugin(name = "SAFPlugin")
public class SAFPlugin extends Plugin {

    private static final int PICK_FOLDER = 9991;

    private PluginCall savedCall;

    @PluginMethod
    public void pickFolder(PluginCall call) {
        savedCall = call;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, intent, PICK_FOLDER);
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);

        if (requestCode == PICK_FOLDER && savedCall != null) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                Uri uri = data.getData();

                getContext().getContentResolver().takePersistableUriPermission(
                        uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                );

                JSObject ret = new JSObject();
                ret.put("folderUri", uri.toString());
                savedCall.resolve(ret);
            } else {
                savedCall.reject("Folder not selected");
            }
        }
    }

    @PluginMethod
    public void renameFiles(PluginCall call) {
        try {
            String folderUri = call.getString("folderUri");
            JSArray files = call.getArray("files");

            Uri uri = Uri.parse(folderUri);
            DocumentFile folder = DocumentFile.fromTreeUri(getContext(), uri);

            int success = 0;
            int error = 0;

            for (int i = 0; i < files.length(); i++) {
                JSONObject obj = files.getJSONObject(i);
                String oldName = obj.getString("oldName");
                String newName = obj.getString("newName");

                for (DocumentFile file : folder.listFiles()) {
                    if (file.getName().equals(oldName)) {
                        if (file.renameTo(newName)) {
                            MediaScannerConnection.scanFile(
                                getContext(),
                                new String[]{ file.getUri().getPath() },
                                null,
                                null
                            );
                            success++;
                        } else {
                            error++;
                        }
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", success);
            ret.put("errors", error);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}