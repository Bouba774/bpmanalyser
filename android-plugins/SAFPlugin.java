package app.lovable.e61fee5bc92f456f8684aa0b1a8db0a3.plugins;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
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
                savedCall.reject("Folder selection cancelled");
            }
        }
    }
}